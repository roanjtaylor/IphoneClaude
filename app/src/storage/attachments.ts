// Attachment byte storage on disk. We keep picked images/documents under the app's
// document directory and store only the uri/metadata on the message (storage/db.ts).
// Base64 is produced on demand at send time (toBase64) and never persisted — keeps the
// DB small. Uses the stable legacy FileSystem API (SDK 54's new API differs).
import * as FileSystem from 'expo-file-system/legacy';
import { newId } from './id';
import type { Attachment } from './types';

const ATTACH_DIR = `${FileSystem.documentDirectory}attachments/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ATTACH_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ATTACH_DIR, { intermediates: true });
  }
}

function extFor(mediaType: string, fallbackName?: string): string {
  if (fallbackName && fallbackName.includes('.')) return fallbackName.split('.').pop()!;
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  };
  return map[mediaType] ?? 'bin';
}

/**
 * Copy a freshly-picked file (temp uri) into permanent app storage and return an
 * Attachment record to persist on the message.
 */
export async function saveAttachment(args: {
  tempUri: string;
  type: 'image' | 'document';
  mediaType: string;
  name?: string;
}): Promise<Attachment> {
  await ensureDir();
  const id = newId('att');
  const ext = extFor(args.mediaType, args.name);
  const dest = `${ATTACH_DIR}${id}.${ext}`;
  await FileSystem.copyAsync({ from: args.tempUri, to: dest });
  return {
    id,
    type: args.type,
    uri: dest,
    mediaType: args.mediaType,
    name: args.name ?? `${id}.${ext}`,
  };
}

export async function deleteAttachment(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

/** Read an attachment's bytes as base64 (no data: prefix) for sending to the server. */
export async function toBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
