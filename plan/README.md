# iPhone-Claude

A personal "Claude app" for an **iPhone 7 stuck on iOS 15.8.5**. The official Claude app
needs iOS 18, so this project builds a look-alike: type a prompt, get the same style of
streamed answer (with web search) — powered by an existing **Claude subscription**, not
the pay-per-token API.

The app is distributed to the phone via **TestFlight** (a verified, working EAS pipeline —
see [`../TESTFLIGHT_SETUP.md`](../TESTFLIGHT_SETUP.md)), and it keeps working **with the
laptop off** because the Claude "brain" runs on an always-on cloud host.

## The one thing to understand first

The Claude brain **cannot run inside the iOS app.** iOS sandboxes apps — there is no Node
runtime, no `child_process`, no way to spawn the `claude` binary on the phone. So:

- The **Expo app** on the iPhone is a *thin chat client*.
- The **Claude server** (Node) runs on an *always-on cloud host* and authenticates with the
  subscription. "No laptop needed" = the server lives in the cloud, not on the phone.

## Architecture at a glance

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

## Docs index

| Doc | What's in it |
| --- | --- |
| [`architecture.md`](architecture.md) | The two components, data flow, why the brain is server-side, subscription auth |
| [`mvp.md`](mvp.md) | MVP scope, non-goals, ordered build checklist, definition of done |
| [`backend.md`](backend.md) | The Claude server spec (Express + claude-agent-sdk, SSE, web search, auth) |
| [`app.md`](app.md) | The Expo RN chat client + TestFlight distribution |
| [`hosting.md`](hosting.md) | Running the server laptop-free on a cloud host + the subscription token |
| [`roadmap.md`](roadmap.md) | Phase 1 MVP → polish → Phase 3 mobile coding from the phone |
| [`decisions.md`](decisions.md) | Constraints & decisions log (incl. the ToS caveat) |

## Reused from existing projects

- **`a_TasteTrainer`** (sibling repo) — the proven subscription-Claude server pattern
  (`@anthropic-ai/claude-agent-sdk` `query()` with no API key) and the SSE streaming helpers.
- **`TESTFLIGHT_SETUP.md`** (this repo) — the verified EAS → TestFlight pipeline from Squadova.
- **`e_Forze`** (sibling repo) — a working Expo `app.json` / `eas.json` template.
