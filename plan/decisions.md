# Decisions & constraints

A log of the choices that shape this project and the constraints behind them.

## Constraints

| Constraint | Implication |
| --- | --- |
| iPhone 7 maxes out at **iOS 15.8.5** | Can't install the official Claude app (needs iOS 18). Build target must support iOS 15.x. |
| Dev machine is **Windows** (no Mac) | Native Xcode builds are out — but **EAS builds iOS in the cloud**, so this is a non-issue. |
| Use the **Claude subscription**, not the API | Auth via the Claude Code OAuth token; `ANTHROPIC_API_KEY` must stay unset. |
| Server must work **with the laptop off** | The Claude server runs on an always-on cloud host, not the laptop and not the phone. |

## Decisions

1. **Subscription via `claude-agent-sdk` `query()` with no API key.**
   Proven in `a_TasteTrainer/server/src/services/claude.ts`. No per-token cost — usage draws
   on the existing plan.

2. **The brain runs in the cloud, not on the phone.**
   iOS sandboxing forbids spawning the `claude` CLI subprocess on-device. "No laptop" =
   always-on cloud host. (See [`architecture.md`](architecture.md), [`hosting.md`](hosting.md).)

3. **TestFlight is the distribution channel — and it works on the iPhone 7.**
   Verified by the user's Squadova build running on this exact device via the EAS pipeline in
   `../TESTFLIGHT_SETUP.md` (`ios.distribution: "store"` + `eas submit`). This **supersedes**
   the earlier worry that "TestFlight requires iOS 16" — the user's working setup is the
   ground truth.

4. **Persistent host (Railway/Fly.io), not serverless.**
   Each request spawns a CLI subprocess and streams for seconds — incompatible with
   serverless execution caps and subprocess restrictions (e.g. Vercel). (See
   [`hosting.md`](hosting.md).)

5. **Headless subscription auth via `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`.**
   This is the one unproven assumption; validate it locally before deploying (`mvp.md` step 2).

6. **Shared-secret header gates the public endpoint.**
   The server exposes subscription-powered Claude on the open internet; a secret the app
   sends is the minimum viable lock.

7. **Single-user, hacked-together MVP is acceptable.**
   No accounts, no multi-tenant concerns, no App Store release. Optimize for "works for me".

## Caveats / known risks

- **ToS gray area.** Driving subscription OAuth credentials from a custom server is not the
  intended Claude Code usage. Acceptable for a private, single-user MVP; revisit before any
  wider use. Stakes rise in Phase 3 (a server that can push to GitHub) — see
  [`roadmap.md`](roadmap.md).
- **Token expiry.** `CLAUDE_CODE_OAUTH_TOKEN` is long-lived (~1 year) but not permanent;
  regenerate with `claude setup-token` and update the host env when auth starts failing.
- **iOS 15 streaming.** Confirm the chosen SSE/streaming library works on the iPhone 7's
  older network stack; fall back to chunked polling only if real SSE proves flaky.
- **Cost.** $0 in API charges (subscription). Only cost is the cloud host (a few $/month) and
  the existing $99/yr Apple Developer membership.
