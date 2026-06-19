# iPhone-Claude

A personal "Claude app" for an **iPhone 7 (iOS 15.8.5)** that can't install the official app
(needs iOS 18). Type a prompt, get the same style of streamed answer (with web search) —
powered by an existing **Claude subscription**, not the pay-per-token API.

Full design lives in [`plan/`](plan/README.md). This README is the build map.

## Layout

```
a_IPhoneClaude/
├── plan/                 # the design docs (read plan/README.md first)
├── server/               # always-on Node "Claude brain" (subscription auth, SSE)
├── app/                  # Expo React Native chat client → TestFlight
└── TESTFLIGHT_SETUP.md   # verified EAS → TestFlight pipeline (works on the iPhone 7)
```

## How it fits together

```
iPhone 7 (TestFlight)            Always-on cloud host (Node)
┌──────────────────┐  HTTPS/SSE  ┌──────────────────────────────────┐
│ app/  Expo chat  │ ──────────► │ server/  Express + claude-agent-  │
│  (thin client)   │ ◄────────── │ sdk query(), subscription auth    │
└──────────────────┘             └──────────────────────────────────┘
```

The Claude brain **cannot run on the phone** (iOS can't spawn the `claude` binary), so the
server runs in the cloud and the app is a thin client. That's what makes it work with the
laptop off.

## Quickstart

1. **Server** ([`server/README.md`](server/README.md))
   ```bash
   cd server && npm install && npm run dev
   curl http://localhost:5174/api/health
   ```
2. **Validate laptop-free auth** — `claude setup-token`, then run the server with only
   `CLAUDE_CODE_OAUTH_TOKEN` set (no `ANTHROPIC_API_KEY`) and confirm chat still answers.
   *Do this before deploying — it's the one unproven assumption.*
3. **Deploy the server** to Railway/Fly.io ([`plan/hosting.md`](plan/hosting.md)); set
   `CLAUDE_CODE_OAUTH_TOKEN` + `APP_SHARED_SECRET`.
4. **App** ([`app/README.md`](app/README.md)) — put the deployed URL + secret in
   `app/app.json` → `extra`, then `eas init` and `npm run ship` to send it to TestFlight.

## Disposable by design

Everything lives in `server/` and `app/` (outside `plan/`). To start over, delete those two
folders — the plan docs stay intact.
