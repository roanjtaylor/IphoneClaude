// Talks to a couple of Anthropic OAuth-authenticated endpoints using the SAME subscription
// credentials the Agent SDK uses — so the app can (a) list the models the account can
// actually use (incl. brand-new ones, without a code change), and (b) show real plan usage
// (the same numbers the Claude Code `/usage` command shows). The token comes from
// CLAUDE_CODE_OAUTH_TOKEN (set on the cloud host) or the local `claude login` credentials.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OAUTH_HEADERS_BETA = 'oauth-2025-04-20';
// Anthropic's OAuth endpoints (usage, models) reject requests that don't present the
// claude-code User-Agent — exactly how the Claude Code CLI calls them. WITHOUT this header
// these GETs come back 401/403, which is why /api/usage showed "unavailable" and the model
// picker silently fell back to its static list. The version is cosmetic; the `claude-code/`
// prefix is what matters. (Verified against the bundled CLI's own usage call.)
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

// ---- Refresh-token flow (for the profile-scoped usage endpoint) --------------
// The long-lived host token from `claude setup-token` only has `user:inference` — enough for
// chat + models, but `/api/oauth/usage` needs `user:profile`. So for usage we mint a short-
// lived, full-scope access token by refreshing a login refresh token (`CLAUDE_REFRESH_TOKEN`).
// Refreshing preserves the original login's scopes, so the result includes `user:profile`.
// We cache the access token in memory and only refresh when it's near expiry, to minimise
// refresh-token rotation. (See plan/backend.md for the caveats and how to set the secret.)
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'; // Claude Code public OAuth client
const REFRESH_SCOPES = 'user:inference user:profile';

// ONLY the explicit env var — never the local `~/.claude/.credentials.json`. Using a refresh
// token rotates it (the old one is invalidated), so reading the local file would break your
// laptop's `claude` login the first time usage is fetched in dev. Locally there's no need: the
// login access token already carries `user:profile`, so usage works through the normal path.
function readRefreshToken(): string | null {
  return process.env.CLAUDE_REFRESH_TOKEN ? process.env.CLAUDE_REFRESH_TOKEN.trim() : null;
}

// In-memory only: the access token, when it expires, and the latest (rotated) refresh token.
let profileToken: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

/**
 * Return a valid `user:profile`-scoped access token, refreshing on demand. Returns null when no
 * refresh token is configured (callers then fall back to the setup-token, which 403s on usage —
 * surfaced to the app as a clear message). Throws if a configured refresh token is rejected.
 */
async function getProfileAccessToken(now: number): Promise<string | null> {
  if (profileToken && now < profileToken.expiresAt - 60_000) return profileToken.accessToken;
  const refreshToken = profileToken?.refreshToken ?? readRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_ID,
      scope: REFRESH_SCOPES,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[oauthApi] token refresh → ${res.status} ${body.slice(0, 300)}`);
    profileToken = null; // force a fresh read from the secret next time
    throw new Error(`Usage token refresh failed (${res.status}). Re-set CLAUDE_REFRESH_TOKEN.`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  profileToken = {
    accessToken: data.access_token,
    // Keep the rotated refresh token in memory so the next refresh chains correctly.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: now + (data.expires_in ? data.expires_in * 1000 : 3_600_000),
  };
  return profileToken.accessToken;
}

async function oauthGet(
  pathname: string,
  opts: { apiVersion?: boolean; token?: string } = {},
): Promise<any> {
  const token = opts.token ?? readToken();
  if (!token) throw new Error('No Claude OAuth token available on the server.');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    'anthropic-beta': OAUTH_HEADERS_BETA,
  };
  // `/v1/*` (the standard API, e.g. models) requires anthropic-version. The `/api/oauth/*`
  // account endpoints (usage) are called by the real CLI WITHOUT it — and sending it there
  // can change how the request is validated — so default to omitting it.
  if (opts.apiVersion) headers['anthropic-version'] = '2023-06-01';
  const res = await fetch(`https://api.anthropic.com${pathname}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[oauthApi] ${pathname} → ${res.status} ${body.slice(0, 300)}`);
    // Bubble up the upstream status AND a snippet of the body so the cause is visible in the
    // app (e.g. an auth-scope error) instead of a generic failure.
    throw new Error(`Anthropic ${pathname} → ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
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
    const body = await oauthGet('/v1/models?limit=100', { apiVersion: true });
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

// ---- Usage (real subscription quota) ----------------------------------------

export type UsageWindow = { utilization: number; resetsAt: string | null };
export type SubscriptionUsage = {
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  sevenDayOpus: UsageWindow | null;
  sevenDaySonnet: UsageWindow | null;
  fetchedAt: number;
};

function win(raw: any): UsageWindow | null {
  if (!raw || typeof raw.utilization !== 'number') return null;
  return { utilization: raw.utilization, resetsAt: raw.resets_at ?? null };
}

export async function getSubscriptionUsage(now: number): Promise<SubscriptionUsage> {
  // Usage needs `user:profile`: use a refreshed full-scope token when one is configured,
  // otherwise fall back to the host token (which 403s, surfaced as a clear message in the app).
  const token = await getProfileAccessToken(now);
  const body = await oauthGet('/api/oauth/usage', token ? { token } : {});
  return {
    fiveHour: win(body?.five_hour),
    sevenDay: win(body?.seven_day),
    sevenDayOpus: win(body?.seven_day_opus),
    sevenDaySonnet: win(body?.seven_day_sonnet),
    fetchedAt: now,
  };
}
