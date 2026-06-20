# Backend — the Claude server (connection + hosting)

The "brain": a Node/Express service that turns an HTTP chat request into a **subscription-
billed** Claude call, streamed back over SSE. Code lives in [`../server/`](../server). It was
generalised from the sibling `a_TasteTrainer` server (one-shot → multi-turn chat).

## How it connects to Claude

- Uses **`@anthropic-ai/claude-agent-sdk`**'s `query()` function, lazy-loaded on first
  request (`server/src/services/claude.ts`).
- **Subscription auth, not API:** with **no `ANTHROPIC_API_KEY`** set, the SDK spawns the
  Claude Code CLI which authenticates from the subscription's OAuth credentials. Locally
  that's `~/.claude/.credentials.json` (from `claude login`); on the host it's the
  `CLAUDE_CODE_OAUTH_TOKEN` env var (from `claude setup-token`).
- **Model:** `claude-opus-4-8` default (`server/src/config.ts`, override via `CLAUDE_MODEL`),
  but the client may pass a per-request `model` and `systemPrompt` (from the app's Settings).
- **Tools:** `allowedTools: ['WebSearch', 'WebFetch']` — enough to mirror the real app's
  live answers, nothing that touches the host filesystem or shell. `maxTurns: 12` allows a
  search → read → answer round-trip. A 180 s timeout + `AbortController` prevents stuck
  subprocesses; the route also **aborts the subprocess when the client disconnects** (stop
  button / dropped connection) via `res` `'close'`.
- **Web-tool visibility:** the stream loop watches for `tool_use` blocks and tool results and
  emits `tool` / `sources` SSE events so the app can show a "Searching the web…" state and
  tappable source links.
- **Conversation & attachments:** stateless on the server — the app sends the full history each
  request. Text turns are flattened into one prompt; when the current turn has **attachments**,
  `server/src/services/claude.ts` switches to the SDK's streaming-input mode and passes the user
  turn as Anthropic content blocks (`{type:'image'|'document', source:{type:'base64',…}}`) —
  still `query()`, still subscription auth.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET`  | `/api/health` | `{ ok: true }`. Public (no secret) — liveness + keep-warm. |
| `POST` | `/api/chat`   | Body `{ messages: [{role, content, attachments?}], model?, systemPrompt? }`. Streams SSE: `delta {text}` · `tool {name,query?}` · `sources {sources}` … then `done {}` (or `error {error}`). Aborts on client disconnect. Requires `x-app-secret`. |
| `POST` | `/api/title`  | Body `{ user, assistant?, model? }` → `{ title }`. One short non-streaming call to auto-name a chat after its first exchange. Requires `x-app-secret`. |
| `GET`  | `/api/usage`  | Real subscription utilization (five-hour + seven-day % and reset times — the numbers Claude Code's `/usage` shows). `503` if the OAuth token is missing/expired. Requires `x-app-secret`. |
| `GET`  | `/api/models` | `{ models }` — the live Anthropic model list for this subscription (so new releases appear in the picker without an app update), cached ~1 h with a static fallback (always `200`). Requires `x-app-secret`. |

`/api/usage` and `/api/models` both go through `server/src/services/oauthApi.ts`, which calls
Anthropic's OAuth endpoints with the host's `CLAUDE_CODE_OAUTH_TOKEN` (no API key, no cost).

JSON body limit is **15 mb** (base64 attachments inflate ~33%).

## Security

A middleware rejects any non-health request whose `x-app-secret` header doesn't match
`APP_SHARED_SECRET`. When that env var is empty (local dev) the gate is open for `curl`.
**On the public host it must always be set.**

## Run it locally

```bash
cd server
npm install
npm run dev                                   # http://localhost:5174
curl http://localhost:5174/api/health         # {"ok":true}
```

Chat test (streams `event: delta` lines):

```bash
curl -N -X POST http://localhost:5174/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hi in one sentence."}]}'
```

---

## Hosting runbook — Hugging Face Spaces (free, no card, 16 GB RAM)

> The server runs 24/7 as a **Docker Space** on HF's free CPU instance (2 vCPU / 16 GB RAM —
> ample headroom for the Claude CLI subprocess), **no credit card**. It sleeps after ~48 h of
> no traffic and wakes on the next request. The public URL is guarded by `APP_SHARED_SECRET`.
> Live deployment: **`https://roanjtaylor-iphone-claude.hf.space`**.
>
> Container config lives in `server/Dockerfile` (Node 20, listens on port **7860**) and the
> HF YAML frontmatter at the top of `server/README.md` (`sdk: docker`, `app_port: 7860`).

**One-time setup:**

1. **Mint the subscription token** (laptop, logged into the subscription):
   ```bash
   claude setup-token
   ```
   Keep the token. Invent a long random `APP_SHARED_SECRET` too (e.g. `openssl rand -hex 24`).
2. **Create the Space** at huggingface.co → New → Space → **SDK: Docker**, **CPU basic
   (free)**. Public is fine (the secret guards it).
3. **Add two Secrets** (Settings → Variables and secrets): `CLAUDE_CODE_OAUTH_TOKEN` and
   `APP_SHARED_SECRET`. (Never add `ANTHROPIC_API_KEY` — that switches to paid billing.)
4. **Push the server code** to the Space's git repo (clone it *outside* this project to avoid
   nesting repos), copying in `Dockerfile`, `.dockerignore`, `package*.json`, `tsconfig.json`,
   `README.md`, and `src/`. The push auth uses your HF **write token** as the git password.
   ⚠️ The HF YAML block **must be the first lines of `README.md`** or HF errors with "Missing
   configuration in README".
5. **Wait for the Docker build** → green **Running**.
6. **Test** the live URL:
   ```bash
   curl https://roanjtaylor-iphone-claude.hf.space/api/health
   curl -N -X POST https://roanjtaylor-iphone-claude.hf.space/api/chat \
     -H 'Content-Type: application/json' -H 'x-app-secret: <secret>' \
     -d '{"messages":[{"role":"user","content":"Say hi."}]}'
   ```

**Re-deploys:** copy changed files into the Space clone, `git commit`, `git push`. Updating a
Secret restarts the Space automatically.

**Env vars on the host:**

| Var | Purpose |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | Subscription auth (from `claude setup-token`). |
| `APP_SHARED_SECRET` | Must match the value baked into the app. |
| `PORT` | `7860` (set in the Dockerfile; HF routes HTTPS to it). |
| `ANTHROPIC_API_KEY` | **Must stay UNSET.** |

**Maintenance:** `setup-token` tokens are long-lived (~1 yr) but not eternal. If chat starts
returning auth errors, re-run `claude setup-token` and update the Space's
`CLAUDE_CODE_OAUTH_TOKEN` secret.

**Fallback host:** Render free (no card) also works but caps RAM at 512 MB (OOM risk for the
Claude CLI) and cold-starts after 15 min idle. Stay on HF Spaces unless you hit a wall.
