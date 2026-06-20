// Full-screen, pinch-to-zoom image viewer, shown as a modal. Reuses the native ScrollView
// zoom (minimum/maximumZoomScale) — the same no-extra-dependency approach ChatScreen uses —
// so it works in Expo Go on iOS 15. Long-press still saves/shares (SavableImage); an explicit
// Close button dismisses (we avoid tap-to-dismiss so it can't fight the pinch gesture).
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { SavableImage } from '../components/SavableImage';

type Props = NativeStackScreenProps<RootStackParamList, 'ImageViewer'>;

export function ImageViewerScreen({ route, navigation }: Props) {
  const { uri } = route.params;
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.center}
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <SavableImage uri={uri} style={{ width, height }} resizeMode="contain" />
      </ScrollView>

      <SafeAreaView style={styles.closeWrap} edges={['top']} pointerEvents="box-none">
        <Pressable style={styles.close} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  closeWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'flex-end' },
  close: {
    margin: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
