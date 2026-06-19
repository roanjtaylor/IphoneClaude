import Constants from 'expo-constants';

// Read runtime config from app.json's `extra` block (baked into the build). Edit the
// values there — or, better for a real deploy, inject them per-build.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  serverUrl?: string;
  appSharedSecret?: string;
};

/** Base URL of the always-on Claude server (plan/hosting.md). */
export const SERVER_URL = extra.serverUrl ?? 'http://localhost:5174';

/** Shared secret sent as `x-app-secret`; must match the server's APP_SHARED_SECRET. */
export const APP_SHARED_SECRET = extra.appSharedSecret ?? '';
