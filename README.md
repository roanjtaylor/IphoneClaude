# iPhone-Claude (Claude7)

A personal Claude app for an **iPhone 7 (iOS 15.8.5)** — which can't run the official app
(needs iOS 18). Type a prompt, get the same style of streamed, web-aware answer, powered by an
existing **Claude subscription** (no API cost). **Shipped and running on the iPhone 7 via
TestFlight.**

## Layout

```
a_IPhoneClaude/
├── plan/        # design & setup record — start at plan/ethos.md
├── server/      # the Claude "brain": Node + claude-agent-sdk, deployed to Hugging Face Spaces
├── app/         # the Expo / React Native chat app → TestFlight
└── todo.md      # what works today + what's missing (the backlog)
```

## How it fits together

```
iPhone 7 (TestFlight)            Hugging Face Space (Docker, 24/7)
┌──────────────────┐  HTTPS/SSE  ┌──────────────────────────────────┐
│ app/  Expo chat  │ ──────────► │ server/  Express + claude-agent-  │
│  (thin client)   │ ◄────────── │ sdk query(), subscription auth    │
└──────────────────┘             └──────────────────────────────────┘
```

The brain can't run on the phone (iOS can't spawn the `claude` binary), so it runs in the
cloud and the app is a thin client — that's what makes it work with the laptop off.

## Docs

| Doc | What it covers |
| --- | --- |
| [`plan/ethos.md`](plan/ethos.md) | Why this exists + principles + status |
| [`plan/architecture.md`](plan/architecture.md) | Overall setup & tech, as built |
| [`plan/backend.md`](plan/backend.md) | The Claude server + Hugging Face hosting runbook |
| [`plan/frontend.md`](plan/frontend.md) | The iPhone app + TestFlight build/ship runbook |
| [`todo.md`](todo.md) | Current capabilities and the backlog (incl. branding) |

## Disposable by design

Everything runtime lives in `server/` and `app/` (outside `plan/`). To start over, delete
those two folders — the plan docs and `todo.md` stay intact.
