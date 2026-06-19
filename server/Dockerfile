# Container for Hugging Face Spaces (Docker SDK) — see DEPLOY-HUGGINGFACE.md.
# HF free "CPU basic" gives 16GB RAM / 2 vCPU with no credit card, plenty of headroom
# for the Claude Code CLI subprocess the Agent SDK spawns.
FROM node:20-slim

# git + certs: the spawned Claude CLI expects a normal userland to be present.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching. Keep devDeps: we run via `tsx` (a devDep) at
# runtime, so do NOT use --omit=dev here.
COPY package.json package-lock.json ./
RUN npm ci

# App source.
COPY tsconfig.json ./
COPY src ./src

# HF Spaces routes HTTPS to app_port (set to 7860 in README.md frontmatter). Our server
# reads PORT, so point it there. HOME is writable (/root) for the CLI's scratch needs.
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

CMD ["npm", "run", "start"]
