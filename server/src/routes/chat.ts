import { Router } from 'express';
import type { Response } from 'express';
import { streamChat, type ChatMessage } from '../services/claude.ts';

// The chat reply streams in over many seconds, so the endpoint emits Server-Sent
// Events: a sequence of `delta` chunks (append each to the assistant bubble), then a
// single `done`, or an `error`. The app reads this with expo/fetch + a stream reader
// (see app/src/api.ts), mirroring TasteTrainer's web client.
function sse(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // No proxy buffering — each chunk must reach the device as it's written.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  return (event: 'delta' | 'done' | 'error', data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

export const chatRouter = Router();

// POST /api/chat  — body: { messages: [{ role, content }, ...] }
// Streams: delta { text } ... then done {}  (or error { error }).
chatRouter.post('/', async (req, res) => {
  const { messages } = req.body as { messages?: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const send = sse(res);
  try {
    await streamChat(messages, (text) => send('delta', { text }));
    send('done', {});
  } catch (err: any) {
    send('error', { error: err?.message ?? 'Chat failed' });
  }
  res.end();
});
