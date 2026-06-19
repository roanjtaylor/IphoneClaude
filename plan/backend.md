# Backend — the Claude server

A small Node/Express service that exposes the Claude subscription over HTTP with streaming.
It is a **generalization of the `a_TasteTrainer` server** (a one-shot curation tool) into a
**multi-turn chat** endpoint.

## Stack

- **Runtime:** Node, run with `tsx` (matches `a_TasteTrainer/server`).
- **Framework:** Express + `cors`.
- **Claude:** `@anthropic-ai/claude-agent-sdk` — the `query()` function, lazy-loaded.
- **Streaming:** Server-Sent Events (SSE).

`package.json` (mirrors `a_TasteTrainer/server/package.json`):

```jsonc
{
  "type": "module",
  "scripts": { "dev": "tsx src/index.ts", "start": "tsx src/index.ts" },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "cors": "^2.8.5",
    "express": "^4.21.2"
  },
  "devDependencies": { "tsx": "^4.19.2", "typescript": "^5.7.2", "@types/express": "^4", "@types/cors": "^2", "@types/node": "^22" }
}
```

## Subscription auth (the important part)

Reuse the mechanism documented at the top of
`a_TasteTrainer/server/src/services/claude.ts`:

- **Do not set `ANTHROPIC_API_KEY`.** When it's absent, the SDK uses the Claude Code OAuth
  credentials → **subscription billing**.
- Locally that's `~/.claude/.credentials.json` (from `claude login`).
- On the cloud host it's the **`CLAUDE_CODE_OAUTH_TOKEN`** env var (from `claude
  setup-token`) — see [`hosting.md`](hosting.md).
- Keep these env hygiene lines from TasteTrainer:
  ```ts
  process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ??= '1';
  process.env.DISABLE_AUTOUPDATER ??= '1';
  ```

## The Claude call — multi-turn chat

TasteTrainer calls `query()` with `maxTurns: 1` and `allowedTools: []` for one-shot JSON.
**This project differs in two ways:** carry the conversation, and enable web search.

```ts
// src/services/claude.ts  (adapted from a_TasteTrainer)
const query = await getQuery();              // lazy import of claude-agent-sdk
const cwd = await ensureClaudeCwd();         // scratch dir OUTSIDE the repo (avoids file-watch restarts)

for await (const message of query({
  prompt,                                    // the latest user turn (history folded into prompt or session)
  options: {
    model: CLAUDE_MODEL,                     // pick a current chat model
    systemPrompt: CHAT_SYSTEM_PROMPT,        // a plain conversational system prompt
    allowedTools: ['WebSearch'],             // enable web search to mirror the real app
    includePartialMessages: true,            // stream tokens as they arrive
    cwd,
    abortController: controller,
  },
})) {
  // forward partial text deltas to the SSE stream (see below)
}
```

**Conversation handling:** the simplest MVP approach is to flatten the message history into
the `prompt` each request (stateless server, history lives on the client). If that proves
limiting, switch to the SDK's session APIs (`unstable_v2_createSession` /
`unstable_v2_resumeSession`) — note TasteTrainer does **not** use these today, so treat it
as an upgrade, not a copy.

## Streaming (SSE)

Reuse the `sse()` helper shape from `a_TasteTrainer/server/src/routes/curation.ts`:

```ts
function sse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
```

Events for the chat endpoint:
- `delta` — `{ text }` a chunk of assistant text (append on the client).
- `done`  — `{}` stream finished.
- `error` — `{ error }` something failed.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/health` | Liveness check (`{ ok: true }`). |
| `POST` | `/api/chat`   | Body `{ messages: [{role, content}, ...] }`. Streams `delta`/`done`/`error` SSE events. |

## Auth middleware (shared secret)

The server is on the public internet exposing subscription-powered Claude, so gate it:

```ts
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  if (req.get('x-app-secret') !== process.env.APP_SHARED_SECRET) return res.sendStatus(401);
  next();
});
```

The app sends `x-app-secret` on every request. Keep the secret in the app config
([`app.md`](app.md)) and as an env var on the host ([`hosting.md`](hosting.md)).

## Env vars

| Var | Purpose |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | Subscription auth on the host (omit locally if already `claude login`'d). |
| `APP_SHARED_SECRET` | Must match the value the app sends. |
| `PORT` | Server port (host usually injects this). |
| `ANTHROPIC_API_KEY` | **Must stay UNSET** — setting it switches to paid API billing. |

## Reuse checklist

- `a_TasteTrainer/server/src/index.ts` — Express bootstrap, CORS, health route.
- `a_TasteTrainer/server/src/services/claude.ts` — lazy `query()` loader, `ensureClaudeCwd`,
  abort controller, the no-API-key auth comment.
- `a_TasteTrainer/server/src/routes/curation.ts` — the `sse()` helper and the
  `for await ... send('progress', ...)` streaming loop.
