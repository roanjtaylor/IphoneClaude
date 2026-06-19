// Talks to Claude via the Claude Agent SDK, using whatever credentials the
// environment already has. With NO ANTHROPIC_API_KEY set, the SDK uses the Claude
// subscription login — locally the OAuth token in ~/.claude/.credentials.json (from
// `claude login`), and on a headless cloud host the CLAUDE_CODE_OAUTH_TOKEN env var
// (from `claude setup-token`). Either way usage draws on the PLAN, not pay-per-use
// API credits. If ANTHROPIC_API_KEY *is* set, the SDK prefers it and bills credits.
// No key is hardcoded here. (See plan/backend.md and plan/hosting.md.)
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_MODEL } from '../config.ts';
import { recordResult } from './usage.ts';

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
type SdkModule = typeof import('@anthropic-ai/claude-agent-sdk');
type QueryFn = SdkModule['query'];
type SDKUserMessage = Parameters<QueryFn>[0]['prompt'] extends string | AsyncIterable<infer U>
  ? U
  : never;
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
export const DEFAULT_SYSTEM_PROMPT = [
  'You are Claude, a helpful, friendly AI assistant made by Anthropic.',
  'Respond conversationally and helpfully, like the Claude app does.',
  'Use the web search tool when the user asks about current events, recent releases,',
  'prices, or anything where up-to-date information matters; otherwise answer directly',
  'from your own knowledge. Format answers in clean Markdown.',
].join(' ');

/** A base64-encoded attachment travelling with a user turn. */
export type Attachment = {
  type: 'image' | 'document';
  /** e.g. "image/jpeg", "application/pdf". */
  mediaType: string;
  /** Raw base64 (no data: prefix). */
  data: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
};

export type StreamCallbacks = {
  onDelta: (text: string) => void;
  /** Fired when Claude starts a web tool (search/fetch). */
  onTool?: (info: { name: string; query?: string }) => void;
  /** Fired with source links discovered while answering. */
  onSources?: (sources: { url: string; title?: string }[]) => void;
};

export type StreamOptions = {
  model?: string;
  systemPrompt?: string;
  /** Abort from the caller (e.g. client disconnected). */
  signal?: AbortSignal;
};

/**
 * Flatten prior conversation turns into a text preamble. The newest message (the
 * current user turn) is handled separately so its attachments can ride along as
 * structured content blocks. History stays text-only (stateless server, plan/backend.md).
 */
function buildHistoryPreamble(messages: ChatMessage[]): string {
  const prior = messages.slice(0, -1);
  if (prior.length === 0) return '';
  const history = prior
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  return `Conversation so far:\n${history}\n\nUser: `;
}

// Media types Claude's vision can actually read. Anything else (e.g. HEIC from an iPhone
// library) must be converted client-side before it gets here; if one slips through we
// normalize the obvious aliases and otherwise let the API reject it loudly.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function normalizeMediaType(mediaType: string): string {
  const t = (mediaType || '').toLowerCase().trim();
  if (t === 'image/jpg' || t === 'image/jfif') return 'image/jpeg';
  if (t === 'image/heic' || t === 'image/heif') return 'image/jpeg'; // best-effort label
  return t;
}

/** Build the Anthropic content-block array for the current user turn. */
function buildUserContent(messages: ChatMessage[]): string | unknown[] {
  const last = messages[messages.length - 1];
  const preamble = buildHistoryPreamble(messages);
  const text = `${preamble}${last.content}`;
  const atts = last.attachments ?? [];
  if (atts.length === 0) return text;

  if (atts.length > 0) {
    console.log(
      `[chat] ${atts.length} attachment(s):`,
      atts.map((a) => `${a.type}/${a.mediaType}(${Math.round((a.data?.length ?? 0) / 1366)}KB)`).join(', '),
    );
  }

  const blocks: unknown[] = [{ type: 'text', text }];
  for (const a of atts) {
    const media_type = normalizeMediaType(a.mediaType);
    if (a.type === 'image') {
      if (!IMAGE_TYPES.has(media_type)) {
        console.warn(`[chat] dropping image with unsupported media type "${a.mediaType}"`);
        continue;
      }
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type, data: a.data },
      });
    } else {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: media_type || 'application/pdf', data: a.data },
      });
    }
  }
  return blocks;
}

/**
 * Turn the conversation into the `prompt` argument for query(). With no attachments
 * this is a plain string (the proven path). With attachments it's a one-shot async
 * iterable yielding a single user message whose content carries the image/document
 * blocks — the SDK's streaming-input mode (see plan: SDKUserMessage.message = MessageParam).
 */
function buildPrompt(messages: ChatMessage[]): string | AsyncIterable<SDKUserMessage> {
  const content = buildUserContent(messages);
  if (typeof content === 'string') return content;

  const sessionId = randomUUID();
  async function* gen(): AsyncGenerator<SDKUserMessage> {
    yield {
      type: 'user',
      message: { role: 'user', content: content as any },
      parent_tool_use_id: null,
      session_id: sessionId,
    } as SDKUserMessage;
  }
  return gen();
}

/** Pull http(s) URLs out of an arbitrary tool-result payload, for source links. */
function extractUrls(value: unknown, into: Map<string, { url: string; title?: string }>): void {
  if (value == null) return;
  if (typeof value === 'string') {
    const re = /https?:\/\/[^\s"'<>)\]]+/g;
    for (const m of value.matchAll(re)) {
      const url = m[0].replace(/[.,;]+$/, '');
      if (!into.has(url)) into.set(url, { url });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) extractUrls(v, into);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Common shapes: { url, title } from web_search results.
    if (typeof obj.url === 'string') {
      const url = obj.url;
      const title = typeof obj.title === 'string' ? obj.title : undefined;
      if (!into.has(url)) into.set(url, { url, title });
    }
    for (const v of Object.values(obj)) extractUrls(v, into);
  }
}

const WEB_TOOL_NAMES = ['WebSearch', 'WebFetch', 'web_search', 'web_fetch'];
function isWebTool(name: unknown): boolean {
  return typeof name === 'string' && WEB_TOOL_NAMES.some((n) => name.includes(n));
}

/**
 * Stream a multi-turn chat reply. Calls callbacks.onDelta with each chunk of assistant
 * text as it is generated. Surfaces web-tool activity via onTool/onSources. Resolves
 * when the reply is complete; rejects on error, timeout, or abort.
 */
export async function streamChat(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options: StreamOptions = {},
): Promise<void> {
  const query = await getQuery();
  const cwd = await ensureClaudeCwd();
  const prompt = buildPrompt(messages);

  // Each query() spawns a Claude Code CLI subprocess. The timeout below only RACES the
  // call; the abortController is what actually tears the subprocess down (in finally),
  // so a stuck call can't leave an orphaned child running. An external signal (client
  // disconnect) is chained in so the subprocess dies promptly when the phone hangs up.
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const seenSources = new Map<string, { url: string; title?: string }>();

  const consume = async (): Promise<void> => {
    for await (const message of query({
      prompt,
      options: {
        model: options.model || CLAUDE_MODEL,
        systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
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
          callbacks.onDelta(ev.delta.text as string);
        } else if (ev?.type === 'content_block_start') {
          const block = ev.content_block;
          if ((block?.type === 'tool_use' || block?.type === 'server_tool_use') && isWebTool(block.name)) {
            callbacks.onTool?.({ name: block.name, query: block.input?.query });
          }
        }
      } else if (message.type === 'assistant') {
        // Complete assistant turn — detect tool_use blocks the partial stream missed.
        const blocks = (message as any).message?.content;
        if (Array.isArray(blocks)) {
          for (const b of blocks) {
            if ((b?.type === 'tool_use' || b?.type === 'server_tool_use') && isWebTool(b.name)) {
              callbacks.onTool?.({ name: b.name, query: b.input?.query });
            }
          }
        }
      } else if (message.type === 'user') {
        // Tool results flow back as user messages; mine them for source URLs.
        const blocks = (message as any).message?.content;
        if (Array.isArray(blocks)) {
          for (const b of blocks) {
            if (b?.type === 'tool_result' || b?.type === 'web_search_tool_result') {
              const before = seenSources.size;
              extractUrls(b.content ?? b, seenSources);
              if (seenSources.size > before) {
                callbacks.onSources?.([...seenSources.values()]);
              }
            }
          }
        }
      } else if (message.type === 'result') {
        // The terminal message. On anything but success, surface it as an error.
        const subtype = (message as any).subtype;
        if (subtype && subtype !== 'success') {
          throw new Error(`Claude returned: ${subtype}`);
        }
        // Accumulate token/cost usage for the Settings "usage" view.
        recordResult(message);
      }
    }
  };

  try {
    // A healthy reply (incl. a web search) finishes well inside this; the cap turns a
    // stuck call into a clear error rather than an indefinite hang.
    await withTimeout(consume(), 180_000, 'Claude chat');
  } finally {
    options.signal?.removeEventListener('abort', onExternalAbort);
    controller.abort();
  }
}

/**
 * One-shot, non-streaming helper: ask Claude for a short conversation title. Used by
 * POST /api/title to auto-name a chat after its first exchange.
 */
export async function generateTitle(
  firstUserMessage: string,
  firstAssistantMessage: string,
  options: StreamOptions = {},
): Promise<string> {
  const query = await getQuery();
  const cwd = await ensureClaudeCwd();
  const controller = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const prompt = [
    'Write a concise title (max 6 words, no quotes, no trailing punctuation) for this chat:',
    '',
    `User: ${firstUserMessage.slice(0, 500)}`,
    `Assistant: ${firstAssistantMessage.slice(0, 500)}`,
    '',
    'Reply with ONLY the title.',
  ].join('\n');

  let title = '';
  const consume = async (): Promise<void> => {
    for await (const message of query({
      prompt,
      options: {
        model: options.model || CLAUDE_MODEL,
        systemPrompt: 'You write short, descriptive chat titles. Reply with only the title.',
        allowedTools: [],
        maxTurns: 1,
        cwd,
        abortController: controller,
      },
    })) {
      if (message.type === 'result' && (message as any).subtype === 'success') {
        title = String((message as any).result ?? '').trim();
      }
    }
  };

  try {
    await withTimeout(consume(), 30_000, 'Claude title');
  } finally {
    controller.abort();
  }

  // Sanitize: strip quotes/newlines, clamp length.
  title = title.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s*\n.*$/s, '').trim();
  if (title.length > 60) title = title.slice(0, 60).trim();
  return title;
}
