# Deploy the server to Hugging Face Spaces (free, no card, 16 GB RAM)

Hugging Face Spaces with the **Docker SDK** runs this server 24/7 on a free CPU instance
(2 vCPU / 16 GB RAM), **no credit card required**. It sleeps after ~48 h of no traffic and
wakes on the next request. The public URL is protected by `APP_SHARED_SECRET`.

You only do steps 1–6 once. Re-deploys are just `git push`.

## 0. Mint your subscription token (one time)

On your laptop, logged into the Claude subscription:

```bash
claude setup-token
```

Copy the printed token — it's your `CLAUDE_CODE_OAUTH_TOKEN`. Also invent a long random
`APP_SHARED_SECRET` (e.g. `openssl rand -hex 24`).

## 1. Create the Space

- Sign in at https://huggingface.co (free, no card).
- **New → Space**. Name it e.g. `iphone-claude`. **SDK: Docker** (blank template).
  Hardware: **CPU basic (free)**. Visibility: Public is fine (the secret guards it).

## 2. Add the secrets

In the Space: **Settings → Variables and secrets → New secret**. Add two **secrets**:

| Name | Value |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | the token from step 0 |
| `APP_SHARED_SECRET` | your random string |

(Do NOT add `ANTHROPIC_API_KEY` — that would switch to paid API billing.)

## 3. Push this `server/` folder to the Space

The Space is its own git repo. Clone it, copy the server files in, and push. From a scratch
dir (replace `<user>`/`<space>`):

```bash
git clone https://huggingface.co/spaces/<user>/<space> hf-space
cd hf-space
# copy the server app in (everything except node_modules/.env — .dockerignore handles the rest)
cp -r /c/Users/roanj/craftsmanship/a_IPhoneClaude/server/{Dockerfile,.dockerignore,package.json,package-lock.json,tsconfig.json,README.md,src} .
git add .
git commit -m "iPhone-Claude server"
git push
```

The push prompts for your HF username + an **access token** as the password (create one at
https://huggingface.co/settings/tokens, role: *write*).

## 4. Watch it build

The Space page shows the Docker build, then **Running**. Build takes a few minutes the first
time.

## 5. Find the URL & test

The app URL is:

```
https://<user>-<space>.hf.space
```

Test it (replace the secret):

```bash
curl https://<user>-<space>.hf.space/api/health      # -> {"ok":true}

curl -N -X POST https://<user>-<space>.hf.space/api/chat \
  -H 'Content-Type: application/json' \
  -H 'x-app-secret: <your APP_SHARED_SECRET>' \
  -d '{"messages":[{"role":"user","content":"Say hi in one sentence."}]}'
```

You should see `event: delta` chunks stream in.

## 6. Point the app at it

In `../app/app.json` → `expo.extra`, set:

```jsonc
"serverUrl": "https://<user>-<space>.hf.space",
"appSharedSecret": "<your APP_SHARED_SECRET>"
```

Then build the app for TestFlight (see `../app/README.md`).

## Notes & caveats

- **Sleeps when idle** (~48 h no traffic) → first request after that is slow while it wakes.
  Fine for personal use; "just stops" with zero cost, as desired.
- **Public Space** = the code/page is visible, but `APP_SHARED_SECRET` blocks anyone from
  using your subscription. Keep the secret secret; never commit `.env`.
- **Token upkeep** — if chat starts returning auth errors, re-run `claude setup-token` and
  update the `CLAUDE_CODE_OAUTH_TOKEN` secret in the Space.
- **Fallback host:** Render free (no card) also works but caps RAM at 512 MB (OOM risk for
  the Claude CLI) and cold-starts after 15 min idle. Use HF Spaces unless you hit a wall.
