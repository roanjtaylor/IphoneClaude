// App-wide settings, loaded from AsyncStorage at boot and editable from the Settings
// screen. Everything that talks to the server (api.ts callers) reads serverUrl/secret/
// model/systemPrompt from here so runtime overrides take effect immediately.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  defaultSettings,
  getSettings,
  resetSettings,
  saveSettings,
  type Settings,
} from '../storage/settings';

type SettingsContextValue = {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
  reset: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    getSettings().then((s) => {
      if (alive) {
        setSettings(s);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(async () => {
    const d = await resetSettings();
    setSettings(d);
  }, []);

  const value = useMemo(
    () => ({ settings, ready, update, reset }),
    [settings, ready, update, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
