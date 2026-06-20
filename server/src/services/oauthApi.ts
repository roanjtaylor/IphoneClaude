// Lists the models the subscription can actually use (incl. brand-new ones, without a code
// change) via Anthropic's OAuth-authenticated /v1/models, using the SAME subscription token the
// Agent SDK uses. The token comes from CLAUDE_CODE_OAUTH_TOKEN (cloud host) or the local
// `claude login` credentials.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OAUTH_HEADERS_BETA = 'oauth-2025-04-20';
// Anthropic's OAuth endpoints reject requests that don't present the claude-code User-Agent —
// exactly how the Claude Code CLI calls them. WITHOUT this header the model list silently falls
// back to the static set. The version is cosmetic; the `claude-code/` prefix is what matters.
const USER_AGENT = 'claude-code/2.0.77 (external, iphone-claude)';

function readToken(): string | null {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return process.env.CLAUDE_CODE_OAUTH_TOKEN.trim();
  if (process.env.ANTHROPIC_OAUTH_TOKEN) return process.env.ANTHROPIC_OAUTH_TOKEN.trim();
  try {
    const p = path.join(os.homedir(), '.claude', '.credentials.json');
    const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function oauthGet(pathname: string): Promise<any> {
  const token = readToken();
  if (!token) throw new Error('No Claude OAuth token available on the server.');
  const res = await fetch(`https://api.anthropic.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': OAUTH_HEADERS_BETA,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[oauthApi] ${pathname} → ${res.status} ${body.slice(0, 300)}`);
    throw new Error(`Anthropic ${pathname} → ${res.status}`);
  }
  return res.json();
}

// ---- Models -----------------------------------------------------------------

export type ModelOption = { id: string; label: string };

// Curated fallback if the live list can't be fetched (offline / token issue).
const FALLBACK_MODELS: ModelOption[] = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

let modelsCache: { at: number; models: ModelOption[] } | null = null;
const MODELS_TTL_MS = 60 * 60 * 1000; // 1h — the list rarely changes.

export async function listModels(now: number): Promise<ModelOption[]> {
  if (modelsCache && now - modelsCache.at < MODELS_TTL_MS) return modelsCache.models;
  try {
    const body = await oauthGet('/v1/models?limit=100');
    const models: ModelOption[] = (body?.data ?? [])
      .filter((m: any) => typeof m?.id === 'string')
      .map((m: any) => ({ id: m.id, label: m.display_name || m.id }));
    if (models.length > 0) {
      modelsCache = { at: now, models };
      return models;
    }
  } catch (err: any) {
    console.warn('[models] live fetch failed, using fallback:', err?.message ?? err);
  }
  return FALLBACK_MODELS;
}
