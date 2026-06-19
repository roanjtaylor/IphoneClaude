// Pick + prepare attachments: photo library, camera, or document. Images are downscaled
// (long edge ~1568px, JPEG ~0.7) before being copied into app storage to fit the upload
// size budget and cut transfer time on the iPhone 7. Returns an Attachment (bytes saved
// to disk) ready to attach to a message, or null if cancelled.
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { saveAttachment } from '../storage/attachments';
import type { Attachment } from '../storage/types';

const MAX_EDGE = 1568;

/**
 * Re-encode a picked image to JPEG. This is essential on iOS: photos from the library are
 * often HEIC/HEIF, which Claude cannot read — if we passed those bytes through (mislabeled
 * as JPEG) the model would silently ignore the image. We force a real JPEG re-encode here.
 * We try a downscale first (to fit the upload budget); if that throws we retry a plain
 * JPEG conversion (no resize); only if BOTH fail do we give up (the caller surfaces an
 * error) rather than send bytes that aren't actually JPEG.
 */
async function prepareImage(uri: string): Promise<{ uri: string; mediaType: string }> {
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: MAX_EDGE } }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    return { uri: result.uri, mediaType: 'image/jpeg' };
  } catch {
    // Resize can fail on some HEIC sources; retry a straight JPEG re-encode. If this also
    // throws, let it propagate — better a clear "couldn't attach" than a silently-ignored
    // image.
    const result = await manipulateAsync(uri, [], { compress: 0.7, format: SaveFormat.JPEG });
    return { uri: result.uri, mediaType: 'image/jpeg' };
  }
}

export async function pickImageFromLibrary(): Promise<Attachment | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const prepared = await prepareImage(asset.uri);
  return saveAttachment({
    tempUri: prepared.uri,
    type: 'image',
    mediaType: prepared.mediaType,
    name: asset.fileName ?? undefined,
  });
}

export async function takePhoto(): Promise<Attachment | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  const prepared = await prepareImage(res.assets[0].uri);
  return saveAttachment({ tempUri: prepared.uri, type: 'image', mediaType: prepared.mediaType });
}

export async function pickDocument(): Promise<Attachment | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  return saveAttachment({
    tempUri: asset.uri,
    type: 'document',
    mediaType: asset.mimeType ?? 'application/pdf',
    name: asset.name,
  });
}
