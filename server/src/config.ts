// Central config. All values come from the environment so the same code runs
// locally and on the cloud host (see plan/hosting.md).

/** Port the HTTP server binds. Cloud hosts inject PORT; default suits local dev. */
export const PORT = Number(process.env.PORT) || 5174;

/** The chat model. Override with CLAUDE_MODEL if desired. */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

/**
 * Shared secret the app must send as the `x-app-secret` header. When EMPTY (the
 * local-dev default) the gate is OPEN — convenient for `curl`. ALWAYS set this on
 * the public cloud host, or anyone can spend your subscription. (plan/backend.md)
 */
export const APP_SHARED_SECRET = process.env.APP_SHARED_SECRET || '';
