// Resolves the active light/dark palette and exposes it (plus the effective scheme) to the
// whole app via useTheme(). The choice is driven by the user's themeMode Setting: 'system'
// follows the OS appearance (useColorScheme, live-updates when the user flips iOS
// light/dark), while 'light'/'dark' pin it. Must live inside SettingsProvider.
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { palette, type Colors, type Scheme } from '../theme';
import { useSettings } from './SettingsContext';

type ThemeContextValue = {
  colors: Colors;
  scheme: Scheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const osScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const mode = settings.themeMode;
    const scheme: Scheme = mode === 'system' ? (osScheme === 'light' ? 'light' : 'dark') : mode;
    return { colors: palette(scheme), scheme };
  }, [settings.themeMode, osScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
