import Constants from 'expo-constants';

// Build-time defaults from app.config.ts's `extra` block (baked into the build). These
// are the FALLBACKS — the runtime Settings screen (storage/settings.ts) can override any
// of them without a rebuild. Resolution order: AsyncStorage override → these defaults.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  serverUrl?: string;
  appSharedSecret?: string;
};

/** Base URL of the always-on Claude server (plan/backend.md). */
export const DEFAULT_SERVER_URL = extra.serverUrl ?? 'http://localhost:5174';

/** Shared secret sent as `x-app-secret`; must match the server's APP_SHARED_SECRET. */
export const DEFAULT_APP_SHARED_SECRET = extra.appSharedSecret ?? '';

/** Default chat model (the server also has its own default if this is blank). */
export const DEFAULT_MODEL = 'claude-opus-4-8';

/** Models offered in the Settings picker. */
export const MODEL_OPTIONS = [
  { label: 'Claude Opus 4.8', value: 'claude-opus-4-8' },
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
] as const;

/** Empty = use the server's built-in conversational system prompt. */
export const DEFAULT_SYSTEM_PROMPT = '';
