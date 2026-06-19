# Roadmap

## Phase 1 — MVP (current)

Mirror the official Claude app for the iPhone 7: prompt → streamed answer (with web search),
powered by the subscription, working with the laptop off. Full scope and done-criteria in
[`mvp.md`](mvp.md).

Deliverables: the cloud-hosted Claude server ([`backend.md`](backend.md),
[`hosting.md`](hosting.md)) and the TestFlight Expo app ([`app.md`](app.md)).

## Phase 2 — Polish (after the MVP works)

Quality-of-life upgrades that make it feel like a real chat app:

- **Conversation persistence** — store chats locally on the device (and/or server) so they
  survive app restarts; a simple history list.
- **Proper multi-turn sessions** — move from "flatten history into the prompt" to the
  Agent SDK session APIs (`unstable_v2_createSession` / `resumeSession`) if context handling
  needs it.
- **Model picker / settings** — choose the model, edit the system prompt, set the server URL
  in-app instead of hard-coding.
- **Attachments** — paste/upload an image or file into a prompt.
- **Reliability** — reconnect on dropped streams, request cancellation (the server already
  has an `AbortController`), nicer error states.

## Phase 3 — Mobile coding from the phone

The original stretch goal: update real GitHub code from the phone, no laptop. This **reuses
the same subscription server**, extended into a coding agent:

- The cloud host already runs Claude Code with subscription auth and can spawn processes —
  so give it a **working copy of a GitHub repo** and broader `allowedTools` (file edits,
  git, shell).
- New endpoints to: clone/pull a repo, run a coding task, show a diff, and **commit + push**
  (using a GitHub token on the host).
- The app grows a "coding" mode: pick a repo, describe a change, review the diff, approve
  the push.
- This is where the laptop genuinely disappears for the dev workflow — the repo, the agent,
  and git all live on the always-on host; the phone is the remote control.

> Phase 3 raises the ToS and security stakes (a server that can push to your repos), so it
> gets its own hardening pass — scoped GitHub tokens, per-repo allowlists, and confirmation
> before any push. Out of scope until Phase 1 is solid.
