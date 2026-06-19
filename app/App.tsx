import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SettingsProvider } from './src/state/SettingsContext';
import { ThemeProvider, useTheme } from './src/state/ThemeContext';
import { RootStack } from './src/navigation/RootStack';
import { initDb } from './src/storage/db';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The themed shell: builds a navigation theme from the active palette so transitions and
// the status bar follow the OS (light/dark) just like the rest of the app.
function ThemedApp() {
  const { colors, scheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb()
      .catch(() => {})
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  const navTheme = useMemo(() => {
    const base = scheme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.bg,
        card: colors.bg,
        text: colors.textStrong,
        primary: colors.accent,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <NavigationContainer theme={navTheme}>
        <RootStack />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
