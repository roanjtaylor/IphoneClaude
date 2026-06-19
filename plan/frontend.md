# Frontend — the iPhone app (build + ship)

The "thin client": an Expo / React Native chat app that calls the server
([`backend.md`](backend.md)) and streams the reply. Code lives in [`../app/`](../app).

## Tech

- **Expo SDK 54**, **React Native 0.81**, **React 19**, TypeScript. SDK 54 matches the
  current Expo Go (so live dev works on the iPhone 7) and builds with Xcode 26 by default; its
  iOS floor is 13.4, so the iPhone 7 (15.8.5) is still supported.
- **`expo/fetch`** for streaming (`app/src/api.ts`) — RN's global `fetch` can't expose the
  response body stream needed to read SSE.
- **`expo-build-properties`** pins the **iOS deployment target to 15.1**; `newArchEnabled`
  is `true` (SDK 54 default, and what Expo Go runs).
- **Config** lives in **`app/app.config.ts`** (a dynamic config that replaced the static
  `app.json`). `expo.extra.serverUrl`/`appSharedSecret` are read from the environment at build
  time — an **EAS secret** in production, a gitignored **`app/.env`** in local dev — and exposed
  at runtime via `expo-constants` (`app/src/config.ts`). The **Settings screen overrides** any of
  these without a rebuild (`app/src/storage/settings.ts`, `AsyncStorage`).
- **Added libraries:** `@react-navigation/native` + `native-stack` + `react-native-screens`
  (navigation), `@react-native-async-storage/async-storage` + `expo-sqlite` (persistence),
  `react-native-markdown-display` (Markdown), `expo-image-picker` / `expo-document-picker` /
  `expo-image-manipulator` (attachments), `expo-clipboard` / `expo-sharing` / `expo-haptics`
  (copy/share/feedback), `expo-splash-screen`.

## What the app does today

A multi-screen, persisted chat app (entry: `app/App.tsx` → `src/navigation/RootStack.tsx`):

- **Conversation list** (`src/screens/ConversationListScreen.tsx`) — saved chats newest-first,
  with new / rename / delete and a gear → Settings.
- **Chat** (`src/screens/ChatScreen.tsx`, `src/hooks/useChat.ts`) — live SSE token streaming;
  **Markdown** rendering with code blocks (highlight + copy), tables, links and images
  (`src/components/MarkdownMessage.tsx`, `CodeBlock.tsx`); **attachments** (photo/camera/
  document, sent as multimodal content blocks); a **stop** button; **copy / regenerate / share**
  per reply; **visible web search** ("Searching the web…" + tappable source chips); a
  **"Waking Claude up…"** banner with a keep-warm ping; haptics and timestamps.
- **Settings** (`src/screens/SettingsScreen.tsx`) — server URL/secret, model picker, system
  prompt, and a "Test connection" ping, all overriding the build-time defaults at runtime.

Conversations + messages persist in **SQLite** (`src/storage/db.ts`); attachment bytes live on
disk (`src/storage/attachments.ts`). History is still resent to the (stateless) server each
turn. Remaining gaps vs. the official app are tracked in [`../todo.md`](../todo.md).

## Identifiers (live)

| Thing | Value |
| --- | --- |
| Bundle identifier | `com.roanjtaylor.claude7` |
| EAS project | `@roanjtaylor/claude7` (`b5edb3ab-0c57-4b37-b3ee-af32fcdec02d`) |
| Apple Team ID | `KZH548TRAQ` (Roan Taylor, Individual) |
| App Store Connect App ID | `6782166474` |

## Run in development

```bash
cd app
npm install
npx expo start            # simulator / Expo Go
```

### Live reload on the iPhone 7 (Expo Go + tunnel)

The iPhone 7 runs the current **Expo Go** (iOS 15.1+ floor) which is **SDK 54** — matching this
project, so the bundle loads. Its old Camera-app → Expo Go handoff is broken, so use Safari as
the middleman:

1. `npx expo start --tunnel` (LAN often can't reach the old phone; the `@expo/ngrok` tunnel
   can). This prints an `exp://…exp.direct` URL (and an `https://` equivalent).
2. Get the **`https://…exp.direct`** URL into **Safari** on the phone (AirDrop/message it, or
   scan the terminal's QR — which opens Safari, not the camera handoff). **Don't** scan with
   the Camera app.
3. Safari triggers the `exp://` deep link → "Open in Expo Go?" → accept. Expo Go loads the
   bundle with hot reload.

Point `serverUrl` at your machine's LAN IP (not `localhost`) to test against a *local* server
from the phone — or leave it on the deployed HF URL to use the live server.

---

## Ship-to-TestFlight runbook (verified on the iPhone 7)

> EAS builds and signs iOS in the cloud — **no Mac, no Xcode, Windows is fine**. This pipeline
> is proven to install on the iPhone 7. Config: `app/eas.json`.

**The load-bearing `eas.json` settings (`production` profile):**
- `ios.distribution: "store"` — TestFlight-eligible (NOT `"internal"`).
- `cli.appVersionSource: "remote"` + `autoIncrement: true` — EAS owns the build number.
- **Xcode 26 / iOS 26 SDK** is mandatory for App Store uploads (since 28 Apr 2026). **SDK 54
  uses it by default**, so no `ios.image` override is needed. (On SDK 53 or lower you'd add
  `ios.image: "macos-sequoia-15.6-xcode-26.2"` here.) Building with the iOS 26 SDK does **not**
  raise the iOS-15.1 deployment floor, so the iPhone 7 still runs it.
- `submit.production.ios.ascAppId: "6782166474"` — submits to the existing App Store app.
- `app.config.ts`: `ITSAppUsesNonExemptEncryption: false` (skips the export-compliance prompt).

**Secret at build time:** `app.config.ts` reads `APP_SHARED_SECRET` (and `SERVER_URL`) from the
environment. For a cloud EAS build, register it once as an EAS secret so the build picks it up:

```bash
cd app
eas env:create --name APP_SHARED_SECRET --value '<secret>' --environment production --visibility secret
```

Local Expo Go reads the same vars from a gitignored `app/.env`. ⚠️ The original secret is in git
history — **rotate it** on the HF Space and use the new value here.

**Build + auto-submit (one command):**

```bash
cd app
npx eas build -p ios --profile production --auto-submit
```

**What it handles for you:** registers the Bundle ID, generates/reuses the Distribution
Certificate + Provisioning Profile, builds on a cloud Mac, creates the App Store Connect app
record on first run, and uploads to TestFlight. First run prompts an interactive Apple login
(email + password + 2FA); later runs reuse stored credentials.

**Then:** wait for Apple to process (5–10 min), open **TestFlight** on the iPhone 7, install
**Claude7**.

### Gotchas (learned the hard way)
- **"Built with iOS 18.2 SDK… must be iOS 26 SDK" (409 on submit)** → built with an old Xcode.
  On SDK 54 the Xcode 26 image is the default; on SDK 53 or lower, set
  `ios.image: "macos-sequoia-15.6-xcode-26.2"` and rebuild.
- **One Distribution Certificate is shared across all your apps** — reuse it (Apple caps how
  many you can have); each app still gets its own provisioning profile.
- **Bundle ID can't be typed into the App Store Connect dropdown** — don't create the app by
  hand; `eas build`/`eas submit` register the ID and create the app for you.
