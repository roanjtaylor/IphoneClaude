# iPhone-Claude server

An always-on Node/Express service that turns HTTP chat requests into **subscription-billed**
Claude calls (via `@anthropic-ai/claude-agent-sdk`), streamed back over SSE. This is the
"brain" — the Expo app is a thin client that calls it. See [`../plan/backend.md`](../plan/backend.md)
and [`../plan/hosting.md`](../plan/hosting.md).

## How auth works (subscription, not API)

The SDK spawns the Claude Code CLI, which uses your **subscription** credentials as long as
**`ANTHROPIC_API_KEY` is unset**:
- **Locally:** run `claude login` once; the SDK reads `~/.claude/.credentials.json`.
- **On a cloud host:** run `claude setup-token` locally once and set the printed token as
  `CLAUDE_CODE_OAUTH_TOKEN` on the host.

## Run locally

```bash
cd server
npm install
cp .env.example .env        # optional; leave APP_SHARED_SECRET empty for open local testing
npm run dev                 # listens on http://localhost:5174
```

Health check:

```bash
curl http://localhost:5174/api/health      # -> {"ok":true}
```

Chat (streams SSE — you'll see `event: delta` lines fill in):

```bash
curl -N -X POST http://localhost:5174/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hello in one sentence."}]}'
```

If `APP_SHARED_SECRET` is set, add `-H 'x-app-secret: <value>'`.

## Validate the laptop-free token BEFORE deploying

This is the one unproven assumption (plan/mvp.md step 2). In a shell with **no** `claude
login` session:

```bash
export CLAUDE_CODE_OAUTH_TOKEN=<token from `claude setup-token`>
unset ANTHROPIC_API_KEY
npm run dev
# then curl the chat endpoint above — if it answers, the cloud host will too.
```

## Deploy (Railway / Fly.io / VPS)

A persistent Node host (NOT serverless — each request spawns a CLI subprocess and streams).

1. Push this `server/` folder to a repo (or deploy via the host's CLI).
2. Set env vars: `CLAUDE_CODE_OAUTH_TOKEN`, `APP_SHARED_SECRET` (a long random string).
   Leave `ANTHROPIC_API_KEY` unset. The host injects `PORT`.
3. Start command: `npm run start`.
4. Confirm `GET /api/health`, then a `curl` chat against the public HTTPS URL.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET`  | `/api/health` | `{ ok: true }`. Public (no secret). |
| `POST` | `/api/chat`   | Body `{ messages: [{role, content}] }`. Streams `delta`/`done`/`error` SSE. Requires `x-app-secret` when set. |
