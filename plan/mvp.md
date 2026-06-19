# MVP

## Goal (definition of done)

> **With the laptop off**, open the app on the iPhone 7 (installed via TestFlight), type a
> prompt, and get back a **streamed, Claude-style answer** — using the subscription, with
> web search available when relevant.

If that one flow works end-to-end, the MVP is done.

## In scope

- Single chat screen: message list + input + send.
- Multi-turn conversation within a session (history is sent with each request).
- Live token streaming (SSE), so text appears as it's generated.
- Web search enabled in the Claude call (matches the official app's behaviour).
- Subscription billing via `CLAUDE_CODE_OAUTH_TOKEN` (no API key, no per-token cost).
- Always-on cloud host so the laptop isn't required.
- Shared-secret header so only this app can call the server.

## Non-goals (deliberately deferred)

- Persisting conversations across app restarts (in-memory/session only for MVP).
- Multiple conversations / history list.
- Attachments, images, voice.
- Model picker / settings UI (hard-code a sensible model first).
- Multi-user support or accounts.
- App Store public release (TestFlight is enough).
- Phase 3 mobile-coding features (see [`roadmap.md`](roadmap.md)).

## Build order

A suggested sequence — each step is independently testable.

1. **Server, local first.** Scaffold the Express + `claude-agent-sdk` server
   ([`backend.md`](backend.md)). Run it locally with the subscription already logged in.
   Verify `POST /api/chat` streams a real answer via `curl`.
2. **Validate the token path.** Mint a token with `claude setup-token`, run the server with
   **only** `CLAUDE_CODE_OAUTH_TOKEN` set (no `ANTHROPIC_API_KEY`, logged-out shell) and
   confirm it still answers. This de-risks the one unproven assumption *before* deploying.
3. **Deploy the server** to the cloud host ([`hosting.md`](hosting.md)). Confirm
   `GET /api/health` and a `curl` chat both work against the public HTTPS URL.
4. **Build the app.** Expo RN chat client ([`app.md`](app.md)) pointed at the cloud URL,
   consuming the SSE stream. Test in Expo Go / dev build first.
5. **Ship to TestFlight.** Replicate `../TESTFLIGHT_SETUP.md` (`eas build -p ios
   --profile production --auto-submit`), wait for processing, install on the iPhone 7.
6. **Final check.** Turn the laptop off. Prompt from the phone. Confirm a streamed answer.

## Risk to retire early

The only genuinely unproven piece is **subscription auth via `CLAUDE_CODE_OAUTH_TOKEN` on a
remote host** (step 2). Everything else is already proven in `a_TasteTrainer` (the server
pattern) and Squadova (the TestFlight pipeline). Do step 2 before step 3.
