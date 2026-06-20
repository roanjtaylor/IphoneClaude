// One chat message. User turns render as plain text in an accent bubble; assistant turns
// render rich Markdown once COMPLETE (plain text while streaming — much cheaper to
// re-render on the iPhone 7, see plan: streaming perf). Shows attachments, sources,
// timestamp, and (for the latest assistant turn) copy/share/regenerate actions.
import { memo, useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../state/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import { radius, spacing, type Colors } from '../theme';
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

function AttachmentPreviews({ message, styles }: { message: Message; styles: Styles }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const atts = message.attachments ?? [];
  if (atts.length === 0) return null;
  return (
    <View style={styles.atts}>
      {atts.map((a) =>
        a.type === 'image' ? (
          <Pressable
            key={a.id}
            onPress={() => navigation.navigate('ImageViewer', { uri: a.uri })}
          >
            <Image source={{ uri: a.uri }} style={styles.thumb} resizeMode="cover" />
          </Pressable>
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
  wide,
  isLastAssistant,
  onRegenerate,
  onContinue,
}: {
  message: Message;
  busy: boolean;
  /** "Fit Width" mode: let bubbles use the full screen width (more text per line). */
  wide?: boolean;
  isLastAssistant: boolean;
  onRegenerate?: () => void;
  onContinue?: () => void;
}) {
  const isUser = message.role === 'user';
  const streaming = message.status === 'streaming';
  const stopped = message.status === 'stopped';
  const empty = message.content.length === 0;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          wide && styles.bubbleWide,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <AttachmentPreviews message={message} styles={styles} />
        {empty && busy ? (
          <ActivityIndicator color={colors.textMuted} size="small" />
        ) : isUser ? (
          message.content.length > 0 ? (
            <Text style={styles.userText}>{message.content}</Text>
          ) : null
        ) : streaming ? (
          // Plain text while tokens stream (cheap); upgrades to Markdown on completion.
          <Text style={styles.assistantText}>{message.content}</Text>
        ) : (
          <MarkdownMessage content={message.content} sources={message.sources} />
        )}

        {message.sources && message.sources.length > 0 ? (
          <SourcesList sources={message.sources} />
        ) : null}
      </View>

      {!isUser && !streaming && message.content.length > 0 ? (
        <View style={styles.metaRow}>
          <View style={styles.metaTopRow}>
            <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
            {stopped ? <Text style={styles.stoppedTag}>· Stopped</Text> : null}
          </View>
          <MessageActions
            content={message.content}
            canRegenerate={isLastAssistant && !busy}
            onRegenerate={onRegenerate}
            stopped={stopped}
            onContinue={onContinue}
          />
        </View>
      ) : null}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: { marginVertical: 4 },
    rowUser: { alignItems: 'flex-end' },
    rowAssistant: { alignItems: 'flex-start' },
    bubble: { maxWidth: '88%', borderRadius: radius.bubble, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleWide: { maxWidth: '100%' },
    bubbleUser: { backgroundColor: c.accent },
    bubbleAssistant: { backgroundColor: c.surface },
    userText: { color: c.textOnAccent, fontSize: 16, lineHeight: 22 },
    assistantText: { color: c.text, fontSize: 16, lineHeight: 22 },
    metaRow: { marginTop: 2, paddingHorizontal: 2 },
    metaTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    time: { color: c.textFaint, fontSize: 11, marginTop: spacing.xs },
    stoppedTag: { color: c.accent, fontSize: 11, marginTop: spacing.xs, fontWeight: '600' },
    atts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
    thumb: { width: 120, height: 120, borderRadius: radius.card, backgroundColor: c.surfaceAlt },
    fileChip: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.card,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      maxWidth: 200,
    },
    fileChipText: { color: c.text, fontSize: 13 },
  });
