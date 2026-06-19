// The bottom input bar: text field, attach (photo/camera/document), pending-attachment
// previews, and a send button that turns into a stop button while a reply streams.
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../theme';
import type { Attachment } from '../storage/types';
import { deleteAttachment } from '../storage/attachments';
import { pickDocument, pickImageFromLibrary, takePhoto } from '../lib/pickAttachment';

const MAX_ATTACHMENTS = 4;

export function Composer({
  busy,
  onSend,
  onStop,
}: {
  busy: boolean;
  onSend: (args: { text: string; attachments: Attachment[] }) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [picking, setPicking] = useState(false);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !busy;

  const addAttachment = async (pick: () => Promise<Attachment | null>) => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit reached', `Up to ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    setPicking(true);
    try {
      const att = await pick();
      if (att) setAttachments((prev) => [...prev, att]);
    } catch {
      Alert.alert('Could not attach', 'Something went wrong picking that file.');
    } finally {
      setPicking(false);
    }
  };

  const onAttachPress = () => {
    Alert.alert('Add attachment', undefined, [
      { text: 'Photo Library', onPress: () => addAttachment(pickImageFromLibrary) },
      { text: 'Take Photo', onPress: () => addAttachment(takePhoto) },
      { text: 'Document', onPress: () => addAttachment(pickDocument) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeAttachment = async (att: Attachment) => {
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    await deleteAttachment(att.uri).catch(() => {});
  };

  const send = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSend({ text: input.trim(), attachments });
    setInput('');
    setAttachments([]);
  };

  return (
    <View style={styles.container}>
      {attachments.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pending}>
          {attachments.map((a) => (
            <Pressable key={a.id} onPress={() => removeAttachment(a)} style={styles.pendingItem}>
              {a.type === 'image' ? (
                <Image source={{ uri: a.uri }} style={styles.pendingThumb} />
              ) : (
                <View style={[styles.pendingThumb, styles.pendingDoc]}>
                  <Text style={styles.pendingDocText} numberOfLines={2}>
                    📄 {a.name}
                  </Text>
                </View>
              )}
              <View style={styles.removeBadge}>
                <Text style={styles.removeBadgeText}>×</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.inputRow}>
        <Pressable
          style={styles.attach}
          onPress={onAttachPress}
          disabled={busy || picking}
          hitSlop={8}
        >
          {picking ? (
            <ActivityIndicator color={colors.textMuted} size="small" />
          ) : (
            <Text style={styles.attachText}>＋</Text>
          )}
        </Pressable>

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message Claude…"
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!busy}
        />

        {busy ? (
          <Pressable style={styles.stop} onPress={onStop}>
            <View style={styles.stopSquare} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.send, !canSend && styles.sendDisabled]}
            onPress={send}
            disabled={!canSend}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  pending: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  pendingItem: { marginRight: spacing.sm },
  pendingThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  pendingDoc: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  pendingDocText: { color: colors.text, fontSize: 9, textAlign: 'center' },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#000',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: { color: '#fff', fontSize: 14, lineHeight: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, gap: spacing.sm },
  attach: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  attachText: { color: colors.text, fontSize: 24, marginTop: -2 },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.textStrong,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.accentDim },
  sendText: { color: colors.textOnAccent, fontSize: 20, fontWeight: '700', marginTop: -2 },
  stop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: colors.accent },
});
