// One chat message. User turns render as plain text in an accent bubble; assistant turns
// render rich Markdown once COMPLETE (plain text while streaming — much cheaper to
// re-render on the iPhone 7, see plan: streaming perf). Shows attachments, sources,
// timestamp, and (for the latest assistant turn) copy/share/regenerate actions.
import { memo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import type { Message } from '../storage/types';
import { MarkdownMessage } from './MarkdownMessage';
import { SourcesList } from './SourcesList';
import { MessageActions } from './MessageActions';

function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function AttachmentPreviews({ message }: { message: Message }) {
  const atts = message.attachments ?? [];
  if (atts.length === 0) return null;
  return (
    <View style={styles.atts}>
      {atts.map((a) =>
        a.type === 'image' ? (
          <Image key={a.id} source={{ uri: a.uri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View key={a.id} style={styles.fileChip}>
            <Text style={styles.fileChipText} numberOfLines={1}>
              📄 {a.name}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

function MessageBubbleImpl({
  message,
  busy,
  isLastAssistant,
  onRegenerate,
}: {
  message: Message;
  busy: boolean;
  isLastAssistant: boolean;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === 'user';
  const streaming = message.status === 'streaming';
  const empty = message.content.length === 0;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <AttachmentPreviews message={message} />
        {empty && busy ? (
          <ActivityIndicator color="#bbb" size="small" />
        ) : isUser ? (
          message.content.length > 0 ? (
            <Text style={styles.userText}>{message.content}</Text>
          ) : null
        ) : streaming ? (
          // Plain text while tokens stream (cheap); upgrades to Markdown on completion.
          <Text style={styles.assistantText}>{message.content}</Text>
        ) : (
          <MarkdownMessage content={message.content} />
        )}

        {message.sources && message.sources.length > 0 ? (
          <SourcesList sources={message.sources} />
        ) : null}
      </View>

      {!isUser && !streaming && message.content.length > 0 ? (
        <View style={styles.metaRow}>
          <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
          <MessageActions
            content={message.content}
            canRegenerate={isLastAssistant && !busy}
            onRegenerate={onRegenerate}
          />
        </View>
      ) : null}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

const styles = StyleSheet.create({
  row: { marginVertical: 4 },
  rowUser: { alignItems: 'flex-end' },
  rowAssistant: { alignItems: 'flex-start' },
  bubble: { maxWidth: '88%', borderRadius: radius.bubble, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: colors.accent },
  bubbleAssistant: { backgroundColor: colors.surface },
  userText: { color: colors.textOnAccent, fontSize: 16, lineHeight: 22 },
  assistantText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  metaRow: { marginTop: 2, paddingHorizontal: 2 },
  time: { color: colors.textFaint, fontSize: 11, marginTop: spacing.xs },
  atts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  thumb: { width: 120, height: 120, borderRadius: radius.card, backgroundColor: colors.surfaceAlt },
  fileChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    maxWidth: 200,
  },
  fileChipText: { color: colors.text, fontSize: 13 },
});
