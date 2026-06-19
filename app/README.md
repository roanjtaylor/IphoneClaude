# Claude7 — Expo chat app

A thin React Native (Expo) chat client for the iPhone 7. It calls the always-on Claude server
(`../server`, hosted on Hugging Face Spaces) and streams the reply.

**Full docs:** the app design + the verified TestFlight build/ship runbook live in
[`../plan/frontend.md`](../plan/frontend.md). Architecture overview:
[`../plan/architecture.md`](../plan/architecture.md). Backlog: [`../todo.md`](../todo.md).

## Configure

Edit `app.json` → `expo.extra`:

```jsonc
"extra": {
  "serverUrl": "https://roanjtaylor-iphone-claude.hf.space",
  "appSharedSecret": "<must match the server's APP_SHARED_SECRET>",
  "eas": { "projectId": "b5edb3ab-0c57-4b37-b3ee-af32fcdec02d" }
}
```

For local testing against a server on your laptop, set `serverUrl` to your machine's LAN IP
(e.g. `http://192.168.1.20:5174`) — `localhost` from the phone points at the phone.

## Run in development

```bash
npm install
npx expo start
```

## Ship to TestFlight

```bash
npm run ship        # eas build -p ios --profile production --auto-submit
```

Requires `ios.image: "macos-sequoia-15.6-xcode-26.2"` in `eas.json` (Apple mandates the
Xcode 26 / iOS 26 SDK). Full detail and gotchas: [`../plan/frontend.md`](../plan/frontend.md).
