import { Router } from 'express';
import { listModels } from '../services/oauthApi.ts';

// GET /api/models — the models this subscription can use (live from Anthropic, cached),
// so the app's model picker stays current (e.g. new releases) without a code change.
// Always 200: falls back to a curated list if the live fetch fails.
export const modelsRouter = Router();

modelsRouter.get('/', async (_req, res) => {
  res.json({ models: await listModels(Date.now()) });
});
