# Claude7 — TODO / product backlog

Where the app is today and what's needed next. Design and "why" live in
[`plan/`](plan/ethos.md). Completed work is condensed into **Shipped** below; the live backlog
is **Next sprint** and beyond.

## ✅ Shipped

A navigated, persisted, multi-screen Expo app + a stateless Node/Express SSE server, live on
the iPhone 7 (iOS 15.8.5) via TestFlight, laptop-free (server on HF Spaces), on the **Claude
subscription** (no API cost). What's already built:

**Core chat**
- Real **Claude Opus 4.8** answers, **live SSE token streaming**, **multi-turn** within a
  session (full history resent each turn).
- **Web search + web fetch** with a visible "Searching the web…" banner and tappable source
  chips (`SourcesList.tsx`; server emits `tool` / `sources` SSE events).
- **Stop** button (client `AbortController` + server abort-on-disconnect).
- **Markdown** replies (`MarkdownMessage.tsx`) — headings, bold, lists, links, images,
  horizontally-scrollable tables, and fenced **code blocks** with lightweight highlighting +
  copy (`CodeBlock.tsx`). Plain text while streaming, upgrades to Markdown on completion
  (iPhone-7 perf).
- **Copy / regenerate / share** per reply (`MessageActions.tsx`); **save images** from replies
  to Photos / share (`SavableImage.tsx`).

**Persistence & navigation**
- **SQLite** conversations + messages (`storage/db.ts`); attachment bytes on disk
  (`storage/attachments.ts`). Chat-list home with new / rename / delete (Edit mode + floating
  ＋) and **auto-titling** (`POST /api/title`).
- **Search conversations** — title + message-text search with snippets
  (`db.searchConversations()`), debounced in the list screen.

**Input & multimodal**
- **Attachments** — image (library/camera) + document (PDF/text), downscaled, sent as base64
  content blocks. Client forces a real JPEG re-encode; server **sniffs the true image format
  from magic bytes** (`sniffImageType`) and drops true HEIC with a clear note. (Image analysis
  root-caused & verified end to end.)
- **Pinch-to-zoom** chats + an **Update Fit** header button (bakes zoom into a layout scale).
- Composer keyboard offset uses the real `useHeaderHeight()` so the last messages aren't hidden.

**Settings & polish**
- **Settings screen** — server URL/secret (lock-protected), **dynamic model picker**
  (`GET /api/models`, live Anthropic list, cached 1 h, static fallback), custom instructions,
  **appearance** (System / Light / Dark), **Test connection**. Runtime overrides via
  `SettingsContext` + AsyncStorage (no rebuild).
- **Light/dark theming** — `theme.ts` palettes resolved at runtime by `ThemeContext` from
  `useColorScheme()` or the Settings override; every screen reads `useTheme()`.
- **Wake-from-sleep UX** — "Waking Claude up…" banner + keep-warm `/api/health` ping on focus.
- Haptics + message timestamps; Claude **mascot** on empty states (`ClaudeMascot.tsx`);
  **landscape** orientation; **shared-secret** auth.

**Branding / build**
- Custom **logo + icon** (`assets/icon.svg` → `icon.png` 1024², orange burst on white) + splash,
  wired in `app.config.ts`. Re-export with:
  `npx sharp-cli -i ./assets/icon.svg -o ./assets/icon.png resize 1024 1024 -- flatten --background "#FFFFFF"`.
- `appSharedSecret` moved out of `app.json` (deleted) → `app.config.ts` reads it from env
  (`.env` locally, EAS secret for prod).

> All server endpoints validated locally via `curl`; the app bundles cleanly for iOS. The
> Phase-2 refactor reached chat feature-parity with the official Claude app.

---

## 🎯 Next sprint

### 🚦 Gates before the next production build
- [ ] **Rotate `APP_SHARED_SECRET`** on the HF Space (the old value is in git history) and set
      the new value as an EAS secret: `eas env:create --name APP_SHARED_SECRET …`. Local dev
      already reads it from the gitignored `app/.env`.
- [ ] **On-device pass** on the iPhone 7 (Expo Go tunnel, then a TestFlight build): markdown,
      persistence across app kill, attachments, web-search sources, stop, copy/export/regenerate,
      light/dark, dynamic model list, search.

### High priority — close the parity gap
- [ ] **Edit & resubmit a user message** + **branch** from an earlier turn (official lets you
      edit a sent prompt and re-run; we only regenerate the last turn).
- [ ] **Incremental Markdown while streaming** — currently plain text until the turn completes
      (iPhone-7 perf tradeoff). Try throttled (~5–8 fps) live Markdown with `React.memo`, falling
      back to plain on older hardware.
- [ ] **Inline numbered citations** — render `[1]`, `[2]` footnote markers in the answer text
      that link to the sources list, instead of only a separate "Sources" block.

### Medium priority
- [ ] **Response style presets** — Normal / Concise / Explanatory / Formal picker, layered onto
      the per-chat custom instructions (the free-text custom-instructions field already ships).
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
- [ ] **Server-side sync (multi-device)** — history is local-only today. Persist conversations
      per-user on the server and sync. Large; only matters beyond one device.
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
</content>
</invoke>
