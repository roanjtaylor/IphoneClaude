// iPhone-Claude backend: turns HTTP chat requests into subscription-billed Claude
// Agent SDK calls, streamed over SSE. Runs on an always-on cloud host so the phone
// works with the laptop off (see plan/hosting.md).
//
// ‼️ Run with plain `tsx` (NO watch). The Agent SDK's lazy import can deadlock under
// `tsx watch` in non-TTY stdio, and `node --watch` spuriously restarts on Windows and
// drops in-flight calls. Plain `tsx` has neither problem. Restart after editing.
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { PORT, APP_SHARED_SECRET } from './config.ts';
import { chatRouter } from './routes/chat.ts';
import { titleRouter } from './routes/title.ts';

const app = express();
app.use(cors());
// 15mb: base64-encoded image/document attachments inflate ~33% over their byte size.
app.use(express.json({ limit: '15mb' }));

// Public liveness check — registered BEFORE the auth gate so monitors don't need the
// secret.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Shared-secret gate. The server exposes subscription-powered Claude on the public
// internet, so every non-health request must present the matching x-app-secret. When
// the secret is unset (local dev) the gate is open for easy `curl` testing.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!APP_SHARED_SECRET) return next();
  if (req.get('x-app-secret') !== APP_SHARED_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

app.use('/api/chat', chatRouter);
app.use('/api/title', titleRouter);

// Turn anything a route throws into JSON the client can display, not a bare 500.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] request error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message ?? 'Internal server error' });
});

// Bind on all interfaces (0.0.0.0) so cloud hosts can route to it.
const server = app.listen(PORT, () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  if (!APP_SHARED_SECRET) {
    console.warn('[server] APP_SHARED_SECRET is unset — auth gate is OPEN (fine locally, NOT for a public host).');
  }
  if (process.env.ANTHROPIC_API_KEY) {
    console.warn('[server] ANTHROPIC_API_KEY is set — Claude will bill the paid API, NOT your subscription. Unset it to use the plan.');
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] port ${PORT} already in use — exiting. Stop the other server first.`);
    process.exit(1);
  } else {
    console.error('[server] server error:', err);
  }
});
