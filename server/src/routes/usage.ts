import { Router } from 'express';
import { getSubscriptionUsage } from '../services/oauthApi.ts';

// GET /api/usage — real subscription usage (the numbers Claude Code's `/usage` shows):
// five-hour and seven-day utilization % + reset times. 503 if the OAuth token can't be
// used (e.g. token missing/expired on the host).
export const usageRouter = Router();

usageRouter.get('/', async (_req, res) => {
  try {
    res.json(await getSubscriptionUsage(Date.now()));
  } catch (err: any) {
    res.status(503).json({ error: err?.message ?? 'Usage unavailable' });
  }
});
