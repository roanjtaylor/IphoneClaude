# Architecture

Two components, talking over HTTPS. Nothing else.

```
iPhone 7 (iOS 15.8.5, TestFlight)        Always-on cloud host (Node, 24/7)
┌────────────────────────────┐  HTTPS   ┌─────────────────────────────────────┐
│ Expo RN chat app           │  (SSE)   │ Express "Claude server"             │
│  - message list + input    │ ───────► │  POST /api/chat  (multi-turn, SSE)  │
│  - streams tokens live     │ ◄─────── │  claude-agent-sdk query()           │
│  - shared-secret header    │          │  NO ANTHROPIC_API_KEY ⇒ subscription│
│  (EAS build → TestFlight)  │          │  auth via CLAUDE_CODE_OAUTH_TOKEN   │
└────────────────────────────┘          │  allowedTools incl. WebSearch       │
                                         └─────────────────────────────────────┘
```

## 1. The Expo app (client)

A thin React Native chat UI. It holds **no Claude logic and no credentials** beyond a
shared secret used to call the server. Responsibilities:

- Render a conversation (message bubbles + input box).
- POST the conversation to `POST /api/chat` on the cloud host.
- Read the **SSE** response and append tokens to the in-progress assistant message as they
  arrive (live streaming, like the real app).

See [`app.md`](app.md).

## 2. The Claude server (brain)

A small Node/Express service that turns an HTTP request into a Claude subscription call.
It reuses the **exact pattern proven in `a_TasteTrainer`**:

- `a_TasteTrainer/server/src/services/claude.ts` lazy-loads
  `@anthropic-ai/claude-agent-sdk` and calls its **`query()`** function.
- With **no `ANTHROPIC_API_KEY`** in the environment, the SDK spawns the bundled `claude`
  CLI, which authenticates with the **Claude subscription** OAuth credentials — so usage
  draws on the plan, not API credits.
- Responses stream back as **Server-Sent Events**, using the `sse()` helper shape in
  `a_TasteTrainer/server/src/routes/curation.ts`.

See [`backend.md`](backend.md).

## Why the brain is server-side (not on the phone)

iOS apps are sandboxed: no Node runtime, no `child_process`, no spawning the `claude`
binary. The Agent SDK works by **spawning the Claude Code CLI as a subprocess** — which is
exactly the thing iOS forbids. Therefore the server must run on a machine that *can* run
Node and spawn processes. To meet the "no laptop" requirement, that machine is an
**always-on cloud host** (see [`hosting.md`](hosting.md)), not the iPhone.

## Request/response data flow

1. User types a prompt; the app appends it to the local conversation array.
2. App sends `POST /api/chat` with `{ messages: [...] }` and the shared-secret header.
3. Server validates the secret, then calls `query()` with the conversation, the chat
   system prompt, and `allowedTools` including web search.
4. As the SDK streams partial message text, the server emits SSE `delta` events.
5. The app appends each delta to the assistant bubble in real time.
6. On completion the server emits a `done` event and ends the stream.

## Subscription auth, in one line

`query()` + **no `ANTHROPIC_API_KEY`** + a valid `CLAUDE_CODE_OAUTH_TOKEN` (from
`claude setup-token`) = the subscription pays, with no laptop in the loop. Details in
[`hosting.md`](hosting.md).
