// Pick + prepare attachments: photo library, camera, or document. Images are downscaled
// (long edge ~1568px, JPEG ~0.7) before being copied into app storage to fit the upload
// size budget and cut transfer time on the iPhone 7. Returns an Attachment (bytes saved
// to disk) ready to attach to a message, or null if cancelled.
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { saveAttachment } from '../storage/attachments';
import type { Attachment } from '../storage/types';

const MAX_EDGE = 1568;

/**
 * True if a base64 payload begins with the JPEG magic bytes. base64 of `FF D8 FF` is `/9j/`,
 * so this is a cheap, reliable "is this really a JPEG?" check on the converted output.
 */
function isJpegBase64(b64: string | undefined): boolean {
  return typeof b64 === 'string' && b64.startsWith('/9j/');
}

/**
 * Re-encode a picked image to a REAL JPEG on disk. This is the crux of the "Claude can't see
 * my photo" bug: iPhone library/camera photos are almost always HEIC, which Claude's vision
 * cannot read. If HEIC bytes reach the server they get detected and dropped, and the model
 * replies that it can't see the image — even though a preview shows fine (iOS renders HEIC
 * natively, which masks the problem).
 *
 * We transcode with the native ImageManipulator and then VERIFY the result is actually a JPEG
 * (magic bytes) before trusting it — so a silent non-conversion can never slip through. The
 * modern context API is the most reliable HEIC→JPEG path on iOS 15; the legacy `manipulateAsync`
 * is kept as a fallback. If BOTH fail to produce a JPEG we throw, so the caller surfaces a
 * clear "couldn't attach" rather than sending unreadable bytes.
 */
async function prepareImage(uri: string): Promise<{ uri: string; mediaType: string }> {
  // Strategy 1: modern SDK-54 context API — resize to fit the upload budget, save as JPEG.
  try {
    const ref = await ImageManipulator.manipulate(uri).resize({ width: MAX_EDGE }).renderAsync();
    const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    if (isJpegBase64(out.base64)) return { uri: out.uri, mediaType: 'image/jpeg' };
  } catch {
    /* fall through to the legacy path */
  }

  // Strategy 2: legacy API, straight JPEG re-encode (no resize) — last resort.
  const out = await manipulateAsync(uri, [], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (isJpegBase64(out.base64)) return { uri: out.uri, mediaType: 'image/jpeg' };

  throw new Error('Could not convert the image to a JPEG Claude can read.');
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
