import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../state/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleMeet'>;

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Injected before any page JS runs. Masks the properties that reveal a WKWebView
// environment despite the desktop Chrome user-agent:
//   - window.webkit / window.webkit.messageHandlers  → the clearest WKWebView signal
//   - window.chrome                                  → real Chrome always has this
//   - navigator.plugins / mimeTypes                  → Chrome has entries; WKWebView has none
//   - navigator.webdriver                            → must be false
const MASK_WEBVIEW_JS = `
(function () {
  try {
    // 1. Hide the WKWebView message bridge — the clearest embedded-browser signal.
    Object.defineProperty(window, 'webkit', { get: () => undefined, configurable: true });

    // 2. Fake the chrome global that real Chrome always exposes.
    if (!window.chrome) {
      Object.defineProperty(window, 'chrome', {
        value: { runtime: {}, loadTimes: function(){}, csi: function(){} },
        configurable: true,
      });
    }

    // 3. navigator.vendor: Chrome → "Google Inc.", Safari/WKWebView → "Apple Computer, Inc."
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.', configurable: true });

    // 4. navigator.platform: WKWebView on iPhone still reports "iPhone" despite the Mac UA.
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel', configurable: true });

    // 5. navigator.maxTouchPoints: iPhone = 5, Mac Chrome = 0. Strong mobile-device signal.
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0, configurable: true });

    // 6. ontouchstart exists on all iOS contexts; it shouldn't on a Mac.
    delete window.ontouchstart;
    delete window.ontouchmove;
    delete window.ontouchend;

    // 7. performance.memory is Chrome-only; its absence signals "not real Chrome".
    if (!performance.memory) {
      Object.defineProperty(performance, 'memory', {
        get: () => ({ jsHeapSizeLimit: 2172649472, totalJSHeapSize: 20000000, usedJSHeapSize: 15000000 }),
        configurable: true,
      });
    }

    // 8. Chrome on desktop has at least one plugin (PDF viewer).
    if (navigator.plugins.length === 0) {
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = [{ name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 0 }];
          Object.defineProperty(arr, 'length', { get: () => 1 });
          return arr;
        },
        configurable: true,
      });
    }

    // 9. webdriver must be false (should already be, but be explicit).
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });

  } catch (e) {}
})();
true;
`;

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
        injectedJavaScriptBeforeContentLoaded={MASK_WEBVIEW_JS}
        javaScriptEnabled
        domStorageEnabled
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
