// Talks to Claude via the Claude Agent SDK, using whatever credentials the
// environment already has. With NO ANTHROPIC_API_KEY set, the SDK uses the Claude
// subscription login — locally the OAuth token in ~/.claude/.credentials.json (from
// `claude login`), and on a headless cloud host the CLAUDE_CODE_OAUTH_TOKEN env var
// (from `claude setup-token`). Either way usage draws on the PLAN, not pay-per-use
// API credits. If ANTHROPIC_API_KEY *is* set, the SDK prefers it and bills credits.
// No key is hardcoded here. (See plan/backend.md and plan/hosting.md.)
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_MODEL } from '../config.ts';

// The Agent SDK doesn't call an HTTP API directly — it spawns a full Claude Code CLI
// subprocess. By default that CLI does non-essential network work on startup
// (refreshing marketplaces, auto-updating) which can stall for minutes on some
// networks. We need none of it, so disable it. Setting these on process.env (not
// options.env) means the spawned CLI inherits them; subscription auth is unaffected.
process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ??= '1';
process.env.DISABLE_AUTOUPDATER ??= '1';

// The SDK is loaded LAZILY (on first request), never at module top-level, wrapped in
// a timeout. It's a heavy module that spawns a CLI; deferring it keeps server boot
// instant, and a misbehaving load fails one request instead of taking down the
// backend. `type` is erased at runtime, so this keeps `query`'s types WITHOUT
// triggering the real import.
type QueryFn = (typeof import('@anthropic-ai/claude-agent-sdk'))['query'];
let cachedQuery: QueryFn | null = null;

/** Reject `p` if it hasn't settled within `ms`, turning a hang into a clear error. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Load (once) and cache the SDK's `query`. */
async function getQuery(): Promise<QueryFn> {
  if (cachedQuery) return cachedQuery;
  const mod = await withTimeout(
    import('@anthropic-ai/claude-agent-sdk'),
    20_000,
    'Loading the Claude Agent SDK',
  );
  cachedQuery = mod.query;
  return cachedQuery;
}

// The spawned Claude CLI scribbles working files into its cwd. Point it at a scratch
// dir OUTSIDE any project so it never picks up a repo's CLAUDE.md and so file-watchers
// (in dev) don't see those writes and restart mid-request.
const CLAUDE_CWD = path.join(os.tmpdir(), 'iphone-claude-cwd');
let claudeCwdReady = false;
async function ensureClaudeCwd(): Promise<string> {
  if (!claudeCwdReady) {
    await fs.mkdir(CLAUDE_CWD, { recursive: true });
    claudeCwdReady = true;
  }
  return CLAUDE_CWD;
}

// A plain conversational system prompt so the model behaves like the Claude chat app.
const CHAT_SYSTEM_PROMPT = [
  'You are Claude, a helpful, friendly AI assistant made by Anthropic.',
  'Respond conversationally and helpfully, like the Claude app does.',
  'Use the web search tool when the user asks about current events, recent releases,',
  'prices, or anything where up-to-date information matters; otherwise answer directly',
  'from your own knowledge. Format answers in clean Markdown.',
].join(' ');

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Flatten the conversation into a single prompt string. The newest message is the
 * user's current turn; everything before it is prior context. This is the simple,
 * stateless MVP approach (history lives on the client and is resent each request).
 */
function buildPrompt(messages: ChatMessage[]): string {
  if (messages.length === 0) return '';
  if (messages.length === 1) return messages[0].content;
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  const last = messages[messages.length - 1];
  return `Conversation so far:\n${history}\n\nUser: ${last.content}`;
}

/**
 * Stream a multi-turn chat reply. Calls `onDelta` with each chunk of assistant text
 * as it is generated (token-ish streaming, like the real app). Resolves when the
 * reply is complete; rejects on error or timeout.
 */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<void> {
  const query = await getQuery();
  const cwd = await ensureClaudeCwd();
  const prompt = buildPrompt(messages);

  // Each query() spawns a Claude Code CLI subprocess. The timeout below only RACES the
  // call; the abortController is what actually tears the subprocess down (in finally),
  // so a stuck call can't leave an orphaned child running.
  const controller = new AbortController();

  const consume = async (): Promise<void> => {
    for await (const message of query({
      prompt,
      options: {
        model: CLAUDE_MODEL,
        systemPrompt: CHAT_SYSTEM_PROMPT,
        // Allow only web tools — enough to mirror the real app, nothing that touches
        // the host filesystem or shell.
        allowedTools: ['WebSearch', 'WebFetch'],
        // Permit enough turns for a tool round-trip (search -> read -> answer).
        maxTurns: 12,
        // Stream partial output so the UI fills in live instead of waiting.
        includePartialMessages: true,
        cwd,
        abortController: controller,
      },
    })) {
      if (message.type === 'stream_event') {
        const ev = (message as any).event;
        // The model's visible answer arrives as text_delta events; forward each one.
        if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          onDelta(ev.delta.text as string);
        }
      } else if (message.type === 'result') {
        // The terminal message. On anything but success, surface it as an error.
        const subtype = (message as any).subtype;
        if (subtype && subtype !== 'success') {
          throw new Error(`Claude returned: ${subtype}`);
        }
      }
    }
  };

  try {
    // A healthy reply (incl. a web search) finishes well inside this; the cap turns a
    // stuck call into a clear error rather than an indefinite hang.
    await withTimeout(consume(), 180_000, 'Claude chat');
  } finally {
    controller.abort();
  }
}
