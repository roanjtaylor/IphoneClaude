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

## ✅ Phase 2 — feature parity (built; pending on-device verification on the iPhone 7)

A major refactor brought the app to chat feature-parity with the official Claude app. The
monolithic `app/App.tsx` is now a navigated, persisted, multi-screen app. Server gained
multimodal input, abort-on-disconnect, web-tool visibility, and a title endpoint. All server
endpoints were validated locally via `curl` (text stream, image multimodal, web search +
sources, title). The app bundles cleanly for iOS. **Still to do: run it on the phone via
Expo Go / TestFlight, and the production-secret steps at the bottom.**

### High priority — done
- [x] **Render Markdown in replies** — `react-native-markdown-display` via
      `app/src/components/MarkdownMessage.tsx` (headings, bold, lists, tables, links, images),
      with fenced code blocks delegated to `CodeBlock.tsx` (lightweight highlight + copy). Renders
      plain text while streaming, upgrades to Markdown on completion (iPhone-7 perf).
- [x] **Custom app logo + icon** — `app/assets/icon.png` (1024², orange burst on white) exported
      from `icon.svg`, wired in `app.config.ts` + a matching splash.
- [x] **Persist conversations** — `expo-sqlite` (`app/src/storage/db.ts`), a chat-list home
      screen with new/rename/delete, and auto-titling via `POST /api/title`.
- [x] **Visible web search** — "Searching the web…" banner + tappable source chips
      (`SourcesList.tsx`); server emits `tool` / `sources` SSE events.

### Medium priority — done
- [x] **Stop button** — client `AbortController` + server abort-on-disconnect (`res` close).
- [x] **Copy message** + **regenerate** + **share/export reply** (`MessageActions.tsx`).
- [x] **Settings screen** — server URL/secret, model picker, system prompt, test connection;
      runtime overrides via `SettingsContext` + AsyncStorage (no rebuild).
- [x] **Wake-from-sleep UX** — "Waking Claude up…" banner after 3 s + keep-warm `/api/health`
      ping on focus.

### Lower priority — done
- [x] Attachments — image (library/camera) + document (PDF/text) via `expo-image-picker` /
      `expo-document-picker`, downscaled, sent as base64 content blocks (multimodal, validated).
- [x] Markdown extras — code blocks with (lightweight) highlighting + copy-code button.
- [x] Haptics (send/copy) + message timestamps.
- [x] Move `appSharedSecret` out of `app.json` → `app.config.ts` reads it from env (`.env`
      locally, EAS secret for prod). `app.json` deleted.

### ⚠️ Before the next production build
- [ ] **Rotate `APP_SHARED_SECRET`** on the HF Space (the old value is in git history) and set
      the new value as an EAS secret: `eas env:create --name APP_SHARED_SECRET ...`. Local dev
      already reads it from the gitignored `app/.env`.
- [ ] **On-device pass** on the iPhone 7 (Expo Go tunnel, then TestFlight build): markdown,
      persistence across app kill, attachments, web-search sources, stop, copy/export/regenerate.

## 🎯 Remaining gaps to fully match the official Claude app

Chat parity is built; these are the features the official app still has that this one doesn't.
Ordered by how much they close the gap for a single-user phone client.

### High priority
- [ ] **Edit & resubmit a user message** + **branch** from an earlier turn (official lets you
      edit a sent prompt and re-run; we only regenerate the last turn).
- [x] **Search conversations** — search bar on the chat list over titles + message text, with a
      snippet of the matching message. `storage/db.ts` `searchConversations()` (title LIKE +
      message-content EXISTS), debounced in `ConversationListScreen.tsx`.
- [ ] **Incremental Markdown while streaming** — currently plain text until the turn completes
      (iPhone-7 perf tradeoff). Try throttled (~5–8 fps) live Markdown with `React.memo`, falling
      back to plain on older hardware.
- [ ] **Inline numbered citations** — render `[1]`, `[2]` footnote markers in the answer text
      that link to the sources list, instead of only a separate "Sources" block.
- [x] **System appearance (light/dark)** — light + dark palettes in `theme.ts`, resolved at
      runtime by `state/ThemeContext.tsx` from `useColorScheme()` (live OS-following) or a
      Settings override (System / Light / Dark). Every screen/component now reads its palette via
      `useTheme()` + a `makeStyles(colors)` factory; nav theme + status bar follow too.

### Usability — done (round 3)
- [x] **Image analysis — root-caused & verified** — the *server* path was proven correct via a
      reproduction test (`solid-red PNG → model says "Red"`, even with web tools + system prompt +
      partial streaming). The real bug was bad bytes from the device. Now hardened on BOTH ends:
      client forces a real JPEG re-encode; server **sniffs the true image format from magic
      bytes** (`sniffImageType`) and self-corrects a wrong label, and detects true HEIC to drop it
      with a clear note instead of sending dead bytes. (Verified a mislabeled image is still seen.)
- [x] **Real subscription usage** — replaced the token-estimate store with the authoritative
      `GET https://api.anthropic.com/api/oauth/usage` (same data as Claude Code's `/usage`):
      five-hour + seven-day utilization % and reset times, via `services/oauthApi.ts` →
      `GET /api/usage`. Settings shows live progress bars.
- [x] **Dynamic model list** — `GET /api/models` fetches the live Anthropic model list with the
      subscription OAuth token (so new releases like **Fable** appear without an app update),
      cached 1h, static fallback. Settings picker is now populated from it.
- [x] **Update Fit** — a header-right button in the chat: bakes the current pinch-zoom into a
      layout scale so the conversation re-flows to fill the (zoomed) width at the same on-screen
      font size. Long-press resets to normal.
- [x] **Composer no longer hides the last messages** — `keyboardVerticalOffset` now uses the real
      `useHeaderHeight()` (was a hard-coded 96 tuned for notched phones), plus a `keyboardDidShow`
      re-scroll-to-end. Fixes the bottom being hidden behind the input bar on the iPhone 7.

### Usability — done (round 2)
- [x] **Images actually analysed** — root cause was `pickAttachment.prepareImage` mislabeling
      HEIC as JPEG when the resize step threw (iPhone library photos are HEIC, which Claude
      can't read). Now forces a real JPEG re-encode (resize → plain-convert fallback → fail
      loudly) so the model always gets readable bytes. Server (`claude.ts`) also normalizes /
      validates `media_type` and logs attachments.
- [x] **Horizontally scrollable tables** — `MarkdownMessage` wraps tables in a horizontal
      `ScrollView` with min-width cells, so wide tables scroll instead of squashing.
- [x] **Pinch-to-zoom chats** — the chat `FlatList` honours iOS `minimumZoomScale={0.5}` /
      `maximumZoomScale={3}`, so you can pinch to zoom out (fit more) or in (read), web-style.
- [x] **Chat list UX** — header **Edit** toggles rename (tap row) / delete (🗑) mode; a floating
      orange **＋** button (bottom-right) starts a new chat; tap the chat **title** in a chat to
      rename it in place. Mascot shown on empty states.
- [x] **Save images from replies** — long-press an image in a reply → Save to Photos (via
      `expo-media-library`) or Share (`components/SavableImage.tsx`).
- [x] **Claude mascot** — `components/ClaudeMascot.tsx` (react-native-svg burst + eyes) on the
      empty chat / empty list states.
- [x] **Custom instructions** — the old "System prompt" field is kept but relabeled "Custom
      instructions" with an explanation + example (it layers onto the system prompt per chat).
- [x] **Usage view** — server accumulates token/cost estimates from each `result` message
      (`services/usage.ts`, `GET /api/usage`); Settings shows replies / tokens / est. cost /
      since-date with a Refresh.

### Usability — done (round 1)
- [x] **Landscape orientation** — `app.config.ts` orientation is now `default` (was `portrait`)
      so the phone can rotate; wide Markdown tables / code blocks get the full landscape width.
      (Native config — takes effect on the next Expo Go reload / dev-client or TestFlight build.)
- [x] **Locked connection settings** — Server URL + shared secret are read-only in Settings
      behind an explicit "🔒 Edit" unlock (with a confirm), so they can't be changed by accident
      and silently break the app. Model / system prompt / appearance stay freely editable.

### Medium priority
- [ ] **Response style / custom instructions** — a preset picker (Normal / Concise / Explanatory /
      Formal) + free-text custom instructions, layered onto the system prompt per chat.
- [ ] **Share / export a whole conversation** (not just one reply) via the iOS share sheet as
      Markdown; optionally copy-all.
- [ ] **Pin / archive chats** and basic organization (folders or favourites) in the chat list.
- [ ] **Real syntax highlighting** — replace the lightweight tokenizer (`components/highlight.ts`)
      with full language grammars + a theme, if it stays smooth on the iPhone 7.
- [ ] **Attachment polish** — paste an image into the input, attach from the Files app, show
      size/type limits and a clearer per-attachment error; consider remembering historical
      attachments across turns (server currently only sends current-turn attachments).
- [ ] **Stop → resume / retry affordance** and a clearer "stopped" state on a cancelled reply.

### Lower priority / larger efforts
- [ ] **Server-side sync (multi-device)** — history is local-only today. To match cross-device
      sync, persist conversations on the server (per-user) and sync. Large; only matters if used
      on more than one device.
- [ ] **Projects** — group chats with shared "project knowledge" files. Sizeable feature.
- [ ] **Artifacts** — a preview pane for generated code/HTML/documents.
- [ ] **Voice dictation / voice mode** — mic-to-text input (iOS 15 speech support on RN is
      finicky — spike first).
- [ ] **Push notifications** when a long reply finishes while backgrounded.
- [ ] **Extended-thinking toggle + display** (show/hide reasoning), if exposed by the SDK.

### Explicitly out of scope (for now)
- **Image generation** (Claude can't natively; would need an external paid image API).
- **Account/login & usage-limit UI** — N/A for a single-user, shared-secret app.

## Phase 3 (separate effort)
- [ ] **Code from the phone** — drive Claude Code against a GitHub repo on the same server to
      edit/commit/push. See [`plan/ethos.md`](plan/ethos.md).

## 🎨 Logo spec — ✅ shipped

**Concept:** the inverse of the official Claude app icon — an **orange symbol on a white
background** (white symbol on clay/orange, inverted).

- Symbol: the Claude "burst" mark (radiating spokes), in Claude clay-orange **`#D97757`**.
- Background: **white** (`#FFFFFF`), filling the icon (iOS masks the corners).
- **Done:** `app/assets/icon.svg` is exported to `app/assets/icon.png` (1024×1024, alpha
  flattened to white for iOS) and `splash-icon.png`, wired via `app.config.ts` (`expo.icon` +
  the `expo-splash-screen` plugin, white background). Re-export with `sharp-cli` if the SVG
  changes: `npx sharp-cli -i ./assets/icon.svg -o ./assets/icon.png resize 1024 1024 -- flatten --background "#FFFFFF"`.
