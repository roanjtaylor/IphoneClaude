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
- Config (`app/app.json` → `expo.extra`): `serverUrl` and `appSharedSecret`, read at runtime
  via `expo-constants` (`app/src/config.ts`).

## What the app does today

One dark, Claude-styled chat screen (`app/App.tsx`): message bubbles, a multiline input +
send button, a typing indicator, auto-scroll, and inline error messages. It keeps the
conversation in memory for the session and resends the full history each turn so follow-ups
work. Tokens stream in live via SSE.

Current limitations (raw Markdown, no persistence, no logo, etc.) are tracked in
[`../todo.md`](../todo.md).

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
- `app.json`: `ITSAppUsesNonExemptEncryption: false` (skips the export-compliance prompt).

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
