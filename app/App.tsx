import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SettingsProvider } from './src/state/SettingsContext';
import { RootStack } from './src/navigation/RootStack';
import { initDb } from './src/storage/db';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Dark navigation theme so the whole app (incl. transitions) matches the Claude palette.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.textStrong,
    primary: colors.accent,
    border: colors.border,
  },
};

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb()
      .catch(() => {})
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SettingsProvider>
        <NavigationContainer theme={navTheme}>
          <RootStack />
        </NavigationContainer>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
