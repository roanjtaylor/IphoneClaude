# Architecture — overall setup & tech (as built)

Two components, talking over HTTPS. That's the whole system.

```
iPhone 7 (iOS 15.8.5, TestFlight)        Hugging Face Space (Docker, always-on)
┌────────────────────────────┐  HTTPS   ┌─────────────────────────────────────┐
│ Expo / React Native app    │  (SSE)   │ Node + Express "Claude server"      │
│  - chat screen, streaming  │ ───────► │  POST /api/chat  (multi-turn, SSE)  │
│  - x-app-secret header     │ ◄─────── │  @anthropic-ai/claude-agent-sdk     │
│  (built by EAS → TestFlight)│         │  NO ANTHROPIC_API_KEY ⇒ subscription│
└────────────────────────────┘          │  auth via CLAUDE_CODE_OAUTH_TOKEN   │
                                         │  tools: WebSearch + WebFetch        │
                                         └─────────────────────────────────────┘
```

## The two halves

| | Frontend (the app) | Backend (the brain) |
| --- | --- | --- |
| Runs on | iPhone 7 | Hugging Face Spaces (free Docker, 16 GB RAM) |
| Tech | Expo SDK 54, React Native 0.81, React 19, TypeScript | Node 20, Express, `@anthropic-ai/claude-agent-sdk`, `tsx` |
| Job | Render chat, stream the reply | Call Claude on the subscription, stream tokens back |
| Detail | [`frontend.md`](frontend.md) | [`backend.md`](backend.md) |

## Why the brain can't live on the phone

The Agent SDK answers a request by **spawning the Claude Code CLI as a subprocess**. iOS
sandboxes apps — no Node runtime, no `child_process`, no spawning binaries — so that cannot
run on-device. The server runs in the cloud and the app is a thin client. Hosting it on an
always-on Space (rather than the laptop) is what makes "laptop-free" true.

## Request flow

1. You type a prompt; the app appends it to the in-memory conversation.
2. App `POST`s `{ messages: [...] }` to `/api/chat` with the `x-app-secret` header.
3. Server checks the secret, then calls the SDK's `query()` with the conversation, a
   conversational system prompt, and `allowedTools: ['WebSearch', 'WebFetch']`.
4. The SDK spawns the Claude CLI, which authenticates with the **subscription** (because no
   API key is set) and streams partial text back.
5. The server forwards each chunk as an SSE `delta` event; the app appends it live. A final
   `done` (or `error`) ends the stream.

## Key tech decisions (and constraints behind them)

- **Subscription auth** — `query()` with no `ANTHROPIC_API_KEY`; on the host a long-lived
  `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`. Zero API cost.
- **Model** — `claude-opus-4-8` (set in `server/src/config.ts`, overridable via `CLAUDE_MODEL`).
- **Streaming** — Server-Sent Events end to end; the client reads it with `expo/fetch`
  (React Native's global `fetch` can't expose the response stream).
- **Persistent host, not serverless** — each request spawns a CLI subprocess and streams for
  seconds, which serverless platforms (execution caps, restricted subprocesses) don't suit.
- **iOS 15 support** — built with the latest Xcode/SDK Apple requires, but the **deployment
  target stays at 15.1**, so the binary still runs on the iPhone 7.
- **TestFlight distribution** — verified to install on this iPhone 7 (overriding the common
  "TestFlight needs iOS 16" claim), via EAS's cloud build + submit.
- **Shared-secret gate** — the server is on the public internet exposing subscription Claude,
  so every request must carry the matching `x-app-secret`.

## Cost & footprint

- **$0** in Claude usage (subscription) and **$0** hosting (HF free tier, no card).
- Only standing cost is the existing **$99/yr Apple Developer** membership.
- Single user, single device. Trade-offs and the ToS gray area (driving subscription creds
  from a server) are accepted for a private MVP.
