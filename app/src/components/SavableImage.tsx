// An image you can press-and-hold to save (to Photos) or share — the same gesture you'd
// use to save a picture from a web page. Works for remote (http) images in replies and
// local file:// attachments; remote ones are downloaded to a temp file first.
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageLoadEventData,
  type ImageStyle,
  type ImageResizeMode,
  type NativeSyntheticEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Tap handler (e.g. open the full-screen viewer). Long-press still saves/shares. */
  onPress?: () => void;
  onLoad?: (e: NativeSyntheticEvent<ImageLoadEventData>) => void;
  onError?: () => void;
};

/** Resolve `uri` to a local file path, downloading a remote image if needed. */
async function toLocalFile(uri: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('data:')) {
    const [, meta = '', b64 = ''] = uri.match(/^data:([^;]*);base64,(.*)$/s) ?? [];
    const ext = meta.includes('png') ? 'png' : meta.includes('gif') ? 'gif' : 'jpg';
    const dest = `${FileSystem.cacheDirectory}saved-${Date.now()}.${ext}`;
    await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  }
  // Remote http(s): download to cache.
  const ext = (uri.split('?')[0].split('.').pop() ?? 'jpg').slice(0, 4);
  const dest = `${FileSystem.cacheDirectory}saved-${Date.now()}.${ext}`;
  const { uri: local } = await FileSystem.downloadAsync(uri, dest);
  return local;
}

export function SavableImage({ uri, style, resizeMode = 'contain', onPress, onLoad, onError }: Props) {
  const [busy, setBusy] = useState(false);

  const saveToPhotos = async () => {
    try {
      setBusy(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to save images.');
        return;
      }
      const local = await toLocalFile(uri);
      await MediaLibrary.saveToLibraryAsync(local);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Saved', 'Image saved to your photos.');
    } catch {
      Alert.alert('Could not save', 'Something went wrong saving that image.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      setBusy(true);
      if (!(await Sharing.isAvailableAsync())) return;
      const local = await toLocalFile(uri);
      await Sharing.shareAsync(local);
    } catch {
      /* cancelled or failed — no-op */
    } finally {
      setBusy(false);
    }
  };

  const onLongPress = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert('Image', undefined, [
      { text: 'Save to Photos', onPress: saveToPhotos },
      { text: 'Share…', onPress: share },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={300}>
      <Image source={{ uri }} style={style} resizeMode={resizeMode} onLoad={onLoad} onError={onError} />
      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.busy]}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  busy: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
});
