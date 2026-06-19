# Ethos — Claude on an iPhone 7, via the Claude subscription

## The problem this solves

The official Claude app requires iOS 18. The target device — an **iPhone 7 — maxes out at
iOS 15.8.5** and can't install it. This project is a personal "Claude app" for that phone:
type a prompt, get the same style of streamed, web-aware answer as the real app, **powered
by an existing Claude subscription** (not the pay-per-token API, so no usage charges).

## Guiding principles

- **Use the subscription, not the API.** Auth runs through the Claude Code OAuth token, so
  every message draws on the plan already paid for. `ANTHROPIC_API_KEY` is deliberately never
  set.
- **Laptop-free.** The phone must work with the computer off. The Claude "brain" therefore
  runs on an always-on cloud host, not on a laptop and not on the phone.
- **Free and frictionless.** Hosting is free with no credit card (Hugging Face Spaces); the
  app ships through the owner's existing Apple/Expo accounts.
- **Hacked-together is fine.** This is a single-user personal tool. Pragmatism over polish;
  ship the smallest thing that genuinely works, then improve.

## Status: shipped and working

The MVP is **live on the iPhone 7 via TestFlight**. It streams real Claude Opus answers with
web search, end to end (app → cloud server → subscription → web tools → streamed back), with
the laptop off. What it does and doesn't do yet is tracked in [`../todo.md`](../todo.md).

## The docs (this folder)

| Doc | What it covers |
| --- | --- |
| `ethos.md` (this file) | Why the project exists and the principles behind it |
| [`architecture.md`](architecture.md) | The overall setup and the tech used, as built |
| [`backend.md`](backend.md) | The Claude server: how it connects to Claude + how it's hosted (runbook) |
| [`frontend.md`](frontend.md) | The iPhone app + the TestFlight build/ship pipeline (runbook) |

Current state and the backlog (including branding) live in the root [`../todo.md`](../todo.md).

## Where it can go

- **Phase 2 — feel like the real app: ✅ built.** Markdown rendering, saved conversations
  (local SQLite + chat list), visible web search with tappable sources, attachments
  (multimodal), a settings screen, stop / copy / regenerate / share, and a custom logo. Pending
  on-device verification + production-secret rotation; remaining parity gaps are in
  [`../todo.md`](../todo.md).
- **Phase 3 — code from the phone:** drive Claude Code against a GitHub repo on the same
  always-on server to edit/commit/push from the iPhone. Reuses the entire backend below.
