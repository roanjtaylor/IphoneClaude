# Hosting — running the server laptop-free

The MVP must work with the laptop off. This doc is how.

## Why it can't run on the phone

The Agent SDK answers a `query()` by **spawning the Claude Code CLI as a subprocess**. iOS
forbids that — apps are sandboxed with no Node runtime and no process spawning. So the
server must live on a machine that *can* spawn processes and stay online 24/7: an
**always-on cloud host**. The iPhone only ever runs the thin chat client.

## Subscription auth without a login session: `claude setup-token`

On the laptop we rely on `~/.claude/.credentials.json` from `claude login`. A headless
cloud host has no interactive login, so instead mint a **long-lived OAuth token**:

```bash
# run ONCE, locally, while logged into the Claude subscription
claude setup-token
```

This prints a token. Set it on the host as:

```
CLAUDE_CODE_OAUTH_TOKEN=<token>
```

With that env var present and **`ANTHROPIC_API_KEY` unset**, the Agent SDK authenticates
against the **subscription** — no laptop, no API charges. (This is the same headless-auth
mechanism the Claude Code GitHub Action uses.)

> **Validate this before deploying.** It's the one unproven assumption in the project. On
> the laptop, open a shell with no `claude login` session and only `CLAUDE_CODE_OAUTH_TOKEN`
> set, run the server, and confirm `/api/chat` still answers. If it does, the cloud host
> will too. (See `mvp.md` step 2.)

## Host choice: persistent container, not serverless

Each request spawns a CLI subprocess and streams for many seconds. That rules out
short-lived serverless functions (execution caps + restricted subprocess spawning, e.g.
Vercel). Use a **persistent Node host**:

- **Recommended: Railway or Fly.io** — cheap, always-on, run a long-lived Node process,
  allow subprocess spawning, give you a stable HTTPS URL, easy env-var management.
- **Alternatives:** a small VPS (Hetzner / DigitalOcean) running the process under
  `pm2`/systemd; Render (persistent service).

The host must be able to run the bundled `claude` CLI (Node + standard Linux userland is
fine; the SDK ships the binary).

## Deploy outline (Railway/Fly flavour)

1. Push the server (the `a_TasteTrainer`-style Express app) to a Git repo or deploy via CLI.
2. Set env vars on the host:
   | Var | Value |
   | --- | --- |
   | `CLAUDE_CODE_OAUTH_TOKEN` | from `claude setup-token` |
   | `APP_SHARED_SECRET` | a random string (also baked into the app) |
   | `ANTHROPIC_API_KEY` | **unset** (leaving it set = paid API billing) |
3. Start command: `npm run start` (`tsx src/index.ts`). Bind to the host-provided `$PORT`.
4. Confirm `GET /api/health` over the public HTTPS URL.
5. `curl` a chat request with the `x-app-secret` header and watch it stream.

## Keeping it alive & locked down

- **Always-on:** disable scale-to-zero / sleep so the first prompt of the day isn't a cold
  start (or accept a few seconds of wake-up if the platform sleeps idle apps).
- **Auth:** the shared-secret middleware ([`backend.md`](backend.md)) is the only thing
  between the public internet and subscription-powered Claude. Use a long random secret;
  rotate it (host env + app rebuild) if it leaks.
- **No CORS wildcard needed in practice** — the caller is a native app, but keep `cors()`
  permissive enough for dev testing.

## Token upkeep

`setup-token` tokens are long-lived (on the order of a year) but not permanent. When the
server starts returning auth errors, re-run `claude setup-token` locally and update
`CLAUDE_CODE_OAUTH_TOKEN` on the host. Logged in `decisions.md` as a known maintenance task.
