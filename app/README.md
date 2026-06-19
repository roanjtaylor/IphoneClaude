# Claude7 — Expo chat app

A thin React Native (Expo) chat client for the iPhone 7. It talks to the always-on Claude
server (`../server`) and streams the reply. See [`../plan/app.md`](../plan/app.md).

## Configure

Edit `app.json` → `expo.extra`:

```jsonc
"extra": {
  "serverUrl": "https://your-cloud-host.example.com",  // the deployed ../server URL
  "appSharedSecret": "must-match-server-APP_SHARED_SECRET",
  "eas": { "projectId": "<written by eas init>" }
}
```

For local testing against the server on your laptop, set `serverUrl` to your machine's LAN
IP (e.g. `http://192.168.1.20:5174`) — `localhost` from the phone points at the phone, not
your computer.

## Run in development

```bash
cd app
npm install
npx expo start          # scan the QR with Expo Go (quickest) or a dev build
```

> The iPhone 7 is on iOS 15.8.5. Recent Expo Go may require a newer iOS, so the real test
> target is a **dev/production build**, not Expo Go. Use the simulator or another device for
> quick iteration, and the TestFlight build for the actual iPhone 7.

## Ship to TestFlight (verified pipeline)

One-time: create the app in App Store Connect, set the bundle ID to match `app.json`
(`com.roanjtaylor.claude7`), then `eas init` (writes the `projectId`). Fill the three Apple
identifiers in `eas.json` → `submit.production.ios`. Full detail: [`../TESTFLIGHT_SETUP.md`](../TESTFLIGHT_SETUP.md).

```bash
npm run ship       # eas build -p ios --profile production --auto-submit
```

Wait for TestFlight processing, then install on the iPhone 7.

## Notes

- **No app icon/splash bundled** — Expo uses defaults so there are no missing-asset build
  errors. Add `icon`/`splash` to `app.json` when you want branding.
- **`newArchEnabled: false`** and **iOS deployment target 15.1** (via `expo-build-properties`)
  keep it friendly to the iPhone 7's old hardware/OS.
- **Streaming** uses `expo/fetch` (`src/api.ts`) — the global `fetch` on RN can't expose the
  response stream. If SSE proves flaky on iOS 15, fall back to chunked polling (plan/app.md).
