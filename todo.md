# Claude7 — TODO / product backlog

Where the app is today and what's needed to make it a fully functional Claude app. Design and
"why" live in [`plan/`](plan/ethos.md).

## ✅ Working today (v1, shipped to TestFlight)

- Real **Claude Opus 4.8** answers on the **Claude subscription** (no API cost).
- **Live token streaming** (SSE) — text types out as it generates.
- **Multi-turn conversation** within a session (full history resent each turn).
- **Web search + web fetch** — live, current answers with sources.
- Runs on the **iPhone 7 / iOS 15.8.5** via TestFlight; **laptop-free** (server on HF Spaces).
- **Shared-secret** auth so only this app can use the subscription.
- Dark, Claude-styled single chat screen: bubbles, input, typing indicator, auto-scroll,
  error messages.

## ❌ Missing — to become a "proper" app

### High priority (biggest feel/usability gains)
- [ ] **Render Markdown in replies.** The model sends Markdown but the UI shows it raw
      (literal `**bold**`, `#` headings, plain URLs). Add a Markdown renderer to the message
      bubble (`app/App.tsx`). *Single biggest UX jump.*
- [ ] **Custom app logo + icon** (see spec below). Currently the Expo default icon.
- [ ] **Persist conversations.** Chat is wiped on app close. Store locally (and/or
      server-side); add a history/list of past chats and "new chat".
- [ ] **Visible web search.** Show a "Searching the web…" state and render sources as tappable
      links instead of raw URLs.

### Medium priority
- [ ] **Stop button** to cancel an in-flight response (server already has an `AbortController`).
- [ ] **Copy message** + **regenerate** actions.
- [ ] **Settings screen** — switch model, edit system prompt, set server URL/secret without a
      rebuild.
- [ ] **Wake-from-sleep UX.** HF Space sleeps after ~48 h idle → first prompt is slow; show a
      "waking up…" state (and/or a keep-warm ping).

### Lower priority / nice-to-have
- [ ] Attachments — paste/upload an image or file into a prompt.
- [ ] Markdown extras — code blocks with syntax highlighting, copy-code button.
- [ ] Haptics / send sound, message timestamps.
- [ ] Move `appSharedSecret` out of `app.json` into an EAS build-time secret.

### Phase 3 (separate effort)
- [ ] **Code from the phone** — drive Claude Code against a GitHub repo on the same server to
      edit/commit/push. See [`plan/ethos.md`](plan/ethos.md).

## 🎨 Logo spec

**Concept:** the inverse of the official Claude app icon — instead of a white symbol on the
clay/orange background, use an **orange symbol on a white background**.

- Symbol: the Claude "burst" mark (radiating spokes), in Claude clay-orange **`#D97757`**.
- Background: **white** (`#FFFFFF`), filling the icon (iOS masks the corners).
- Deliverables: `app/assets/icon.png` at **1024×1024**, plus referencing it in `app.json`
  (`expo.ios.icon` / `expo.icon`). Optionally a matching splash.
- A starter **`app/assets/icon.svg`** (white bg, orange burst) is included — export it to a
  1024×1024 PNG, drop it in `app/assets/`, wire it in `app.json`, and rebuild.
