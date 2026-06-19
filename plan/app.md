# App — the Expo chat client

A thin React Native (Expo) chat UI. No Claude logic, no credentials — it just talks to the
cloud server ([`backend.md`](backend.md)) and renders the streamed reply.

## Toolchain & device compatibility

- **Expo + EAS managed workflow** — same as Squadova and the local `e_Forze` project.
- **Pin the same Expo SDK version Squadova uses** — that build is *verified to run on the
  iPhone 7*, so it's the known-good baseline. Don't jump to a newer SDK without checking its
  iOS floor (recent Expo SDKs target iOS 15.1+, which the iPhone 7 on 15.8.5 clears, but
  match Squadova to be safe).
- Set the iOS deployment target to **15.x** and consider `newArchEnabled: false` (the
  iPhone 7's A10 is old; only enable the new architecture if Squadova does).

`app.json` essentials (combine `e_Forze/app.json` shape with the TestFlight bits from
`../TESTFLIGHT_SETUP.md`):

```jsonc
{
  "expo": {
    "name": "Claude7",
    "slug": "claude7",
    "owner": "roanjtaylor",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.<your-namespace>.claude7",   // must pre-exist in App Store Connect
      "supportsTablet": false,
      "infoPlist": { "ITSAppUsesNonExemptEncryption": false }
    },
    "extra": { "eas": { "projectId": "<from eas init>" } }
  }
}
```

## Screen (MVP)

One screen, three parts:

1. **Message list** — scrollable bubbles (user right, assistant left). The in-progress
   assistant bubble grows as deltas arrive.
2. **Input row** — text field + send button.
3. **State** — a `messages` array in component state; append the user turn, then create an
   empty assistant turn and fill it from the stream.

## Config

Two values, kept in app config / `expo-constants` `extra` (or `.env` via `app.config`):

| Key | Example | Purpose |
| --- | --- | --- |
| `SERVER_URL` | `https://claude7.up.railway.app` | The cloud host base URL. |
| `APP_SHARED_SECRET` | `<random string>` | Sent as `x-app-secret`; must match the server. |

## Consuming the SSE stream

`fetch` on RN doesn't expose a `ReadableStream` reader the way the browser does, so use
`expo/fetch` (the streaming-capable fetch) or `react-native-sse` / an EventSource polyfill.
The parsing loop mirrors `a_TasteTrainer/web/src/lib/api.ts` `streamSSE`:

```ts
// pseudo-code — split on "\n\n", read "event:" / "data:" lines
const res = await fetch(`${SERVER_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-app-secret': APP_SHARED_SECRET },
  body: JSON.stringify({ messages }),
});
// read the body stream; for each "delta" event → append text to the assistant message;
// on "done" → finalize; on "error" → show the message.
```

> Implementation note: confirm the chosen streaming library works on the **old iOS 15
> WebView/network stack**. If real SSE is flaky on the device, a pragmatic fallback is
> chunked polling, but try SSE first — it's what makes the typing-out effect work.

## Distribution → TestFlight

This is **already solved**; replicate `../TESTFLIGHT_SETUP.md` exactly. The load-bearing bits:

- `eas.json` production profile: `ios.distribution: "store"` (NOT `"internal"`),
  `cli.appVersionSource: "remote"`, `autoIncrement: true`, and the `submit.production.ios`
  block with **Apple Team ID, Apple ID, ASC App ID**.
- `app.json`: `ITSAppUsesNonExemptEncryption: false`, bundle ID matching App Store Connect.
- Build + submit in one go:
  ```bash
  eas build -p ios --profile production --auto-submit
  ```
- Let EAS generate/store the signing certs on first build (no Mac needed — EAS builds on
  cloud macOS workers). Wait for TestFlight processing, then install on the iPhone 7.

## Structural template

Mirror Squadova's `product/mobile` layout (Expo Router, screens, api client) — point at it
directly when scaffolding. Locally, `e_Forze/` is the nearest reference for `app.json` /
`eas.json` conventions and the `roanjtaylor` Expo owner.
