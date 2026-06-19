---
title: iPhone Claude Server
emoji: 🤖
colorFrom: indigo
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# iPhone-Claude server

> The YAML block above is **required by Hugging Face Spaces** and must stay at the very top
> of this file (`sdk: docker`, `app_port: 7860`). Do not move it.

The always-on Claude "brain": Node + Express + `@anthropic-ai/claude-agent-sdk`, streaming
subscription-billed Claude over SSE. It runs on Hugging Face Spaces so the iPhone app works
with the laptop off.

**Full docs:**
- Design + API + how it connects to Claude → [`../plan/backend.md`](../plan/backend.md)
- Hosting / deploy runbook (HF Spaces) → the "Hosting runbook" section of the same file
- Overall architecture → [`../plan/architecture.md`](../plan/architecture.md)

## Quick local run

```bash
npm install
npm run dev                                 # http://localhost:5174
curl http://localhost:5174/api/health       # {"ok":true}
```

Uses your subscription automatically when `claude login` is set and `ANTHROPIC_API_KEY` is
unset. `.env.example` documents the env vars.
