import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../state/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleMeet'>;

// Desktop Chrome UA bypasses Google's "unsupported browser" block on iOS 15.
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function GoogleMeetScreen({ route }: Props) {
  const { meetCode } = route.params;
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <WebView
        source={{ uri: `https://meet.google.com/${meetCode}` }}
        userAgent={DESKTOP_UA}
        javaScriptEnabled
        domStorageEnabled
        // sharedCookiesEnabled lets the WebView pick up any existing Google
        // sign-in session from Safari so the user doesn't need to log in again.
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        originWhitelist={['*']}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          setLoading(false);
          setError(e.nativeEvent.description);
        }}
        style={{ flex: 1 }}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading Google Meet…
          </Text>
        </View>
      )}
      {error && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            Could not load Google Meet.{'\n'}Check your connection and try again.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
