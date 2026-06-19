# Shipping to TestFlight with EAS (no Mac, no Xcode)

How Squadova uploads iOS builds to TestFlight. This is a **verified, working setup** —
Expo + EAS managed workflow — written so another project can replicate it. The iOS
build runs on EAS's cloud macOS workers, so **Windows/Linux dev machines work fine**.

Two commands do everything:

```bash
eas build   --platform ios --profile production   # compile + sign in the cloud → .ipa
eas submit  --platform ios --profile production   # upload .ipa to App Store Connect → TestFlight
```

No Xcode. No Fastlane. No local Mac.

---

## 1. One-time prerequisites

| Thing | What you need | Example |
| --- | --- | --- |
| **Apple Developer Program** | Paid membership ($99/yr) | — |
| **Apple Team ID** | 10-char team identifier | `KZH548TRAQ` |
| **Apple ID** | The developer account email | `you@example.com` |
| **App in App Store Connect** | Create the app record first | — |
| **ASC App ID** | Numeric app id from App Store Connect | `6757597522` |
| **Bundle identifier** | Set in App Store Connect, must match app config | `com.playonsoftware.squadova` |
| **EAS CLI + account** | `npm i -g eas-cli` then `eas login` | — |
| **EAS project** | `eas init` → writes `projectId` into app config | — |

> The bundle ID must **already exist in App Store Connect** and match
> `ios.bundleIdentifier` in `app.json` **exactly**, or submit fails.

---

## 2. `app.json` — the iOS bits that matter

```json
{
  "expo": {
    "version": "2.9.4",
    "ios": {
      "bundleIdentifier": "com.playonsoftware.squadova",
      "supportsTablet": true,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "extra": {
      "eas": { "projectId": "31db5043-186b-47b0-b217-5d358073567b" }
    }
  }
}
```

- `version` = human-facing marketing version. **You do not hand-edit the build number** —
  EAS owns it (see below).
- `ITSAppUsesNonExemptEncryption: false` skips the export-compliance question that
  otherwise blocks **every** TestFlight processing run.

---

## 3. `eas.json` — the load-bearing config

```json
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "ios": { "distribution": "store" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "you@example.com",
        "ascAppId": "6757597522",
        "appleTeamId": "KZH548TRAQ"
      }
    }
  }
}
```

**The trio that makes a build TestFlight-eligible:**

1. `ios.distribution: "store"` — store-signed. `"internal"` produces ad-hoc/simulator
   builds that **cannot** go to TestFlight.
2. `cli.appVersionSource: "remote"` — EAS keeps the build-number counter server-side.
3. `autoIncrement: true` — bumps the iOS build number each build, so App Store Connect
   never rejects a duplicate.

---

## 4. The flow

```bash
# Build: EAS provisions a cloud macOS worker, manages signing certs + provisioning
#        profiles, compiles, returns a store-signed .ipa
eas build --platform ios --profile production

# Submit: uploads that build to App Store Connect → appears in TestFlight
eas submit --platform ios --profile production
```

Chain them in one go:

```bash
eas build -p ios --profile production --auto-submit
```

Squadova wires these as npm scripts (`product/mobile/package.json`):

```json
"build:ios:production": "eas build --platform ios --profile production",
"submit:ios":           "eas submit --platform ios --profile production"
```

---

## 5. What EAS handles for you (why no Mac is needed)

- **Signing credentials** — on the first build EAS offers to generate and store your
  **Distribution Certificate** and **Provisioning Profile** in your Expo account, then
  reuses them. (This is the part people wrongly assume needs a Mac.)
- **Build numbers** — `appVersionSource: "remote"` + `autoIncrement` manage the counter
  entirely. Don't hand-edit `buildNumber`.
- **The macOS build environment** — cloud-hosted, so Windows/Linux is fully supported.

---

## 6. Gotchas

- **`distribution` must be `"store"`** on the production profile — `"internal"` is not
  TestFlight-eligible.
- **Bundle ID must pre-exist in App Store Connect** and match `app.json` exactly.
- **"Build number is 1 behind" warnings are normal** — App Store Connect's counter is
  ahead of EAS's local view; the `remote` source reconciles it. Don't try to fix it with
  the interactive `eas build:version:set`.
- **First submit may need an app-specific password** from appleid.apple.com if 2FA
  interactive auth doesn't complete in the CLI.
- **TestFlight "processing" delay** — after submit, Apple processes the build (minutes to
  ~an hour) before testers can install. That delay is Apple-side, not a setup failure.

---

## 7. Replication checklist

1. Apple Developer account → create the app in App Store Connect → record **Apple Team
   ID, Apple ID, ASC App ID, bundle ID**.
2. `eas init`; set `ios.bundleIdentifier` in `app.json` to match the App Store Connect app.
3. In `eas.json`: production profile with `ios.distribution: "store"` + `autoIncrement:
   true`, `cli.appVersionSource: "remote"`, and the `submit.production.ios` block with the
   three Apple identifiers.
4. `eas build -p ios --profile production` (let EAS generate signing creds when prompted).
5. `eas submit -p ios --profile production`.
6. Wait for TestFlight processing, then add testers.

That's the whole pipeline — EAS abstracts the Mac/Xcode/Fastlane layer away.
