// Runtime-overridable app settings, persisted in AsyncStorage. These override the
// build-time defaults from app.config.ts (src/config.ts) so the user can change the
// server URL/secret/model/system prompt without a rebuild.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_APP_SHARED_SECRET,
  DEFAULT_MODEL,
  DEFAULT_SERVER_URL,
  DEFAULT_SYSTEM_PROMPT,
} from '../config';

export type Settings = {
  serverUrl: string;
  appSharedSecret: string;
  model: string;
  systemPrompt: string;
};

const KEY = 'claude7.settings.v1';

export function defaultSettings(): Settings {
  return {
    serverUrl: DEFAULT_SERVER_URL,
    appSharedSecret: DEFAULT_APP_SHARED_SECRET,
    model: DEFAULT_MODEL,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Merge over defaults so a newly-added field is always present.
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(next: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function resetSettings(): Promise<Settings> {
  const d = defaultSettings();
  await saveSettings(d);
  return d;
}
