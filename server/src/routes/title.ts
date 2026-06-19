import { Router } from 'express';
import { generateTitle } from '../services/claude.ts';

// POST /api/title — body: { user: string, assistant: string, model? }
// Returns { title }. Used by the app to auto-name a chat after its first exchange.
// Best-effort: the app keeps its own fallback title if this fails.
export const titleRouter = Router();

titleRouter.post('/', async (req, res) => {
  const { user, assistant, model } = req.body as {
    user?: string;
    assistant?: string;
    model?: string;
  };
  if (typeof user !== 'string' || user.trim().length === 0) {
    return res.status(400).json({ error: 'user message is required' });
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const title = await generateTitle(user, assistant ?? '', {
      model,
      signal: controller.signal,
    });
    res.json({ title });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Title generation failed' });
  }
});
