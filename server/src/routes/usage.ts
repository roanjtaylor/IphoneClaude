import { Router } from 'express';
import { getUsage, resetUsage } from '../services/usage.ts';

// GET  /api/usage — cumulative token/cost totals (estimates) since `since`.
// POST /api/usage/reset — zero the counters (used by the Settings "Reset" action).
export const usageRouter = Router();

usageRouter.get('/', (_req, res) => res.json(getUsage()));
usageRouter.post('/reset', (_req, res) => res.json(resetUsage()));
