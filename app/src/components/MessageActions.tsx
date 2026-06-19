// Row of actions under an assistant message: copy, export (share sheet), regenerate.
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useMemo, useState } from 'react';
import { useTheme } from '../state/ThemeContext';
import { spacing, type Colors } from '../theme';

export function MessageActions({
  content,
  onRegenerate,
  canRegenerate,
}: {
  content: string;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const copy = async () => {
    await Clipboard.setStringAsync(content);
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportReply = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        // Fallback: at least copy it.
        await copy();
        return;
      }
      const path = `${FileSystem.cacheDirectory}claude-reply-${Date.now()}.md`;
      await FileSystem.writeAsStringAsync(path, content);
      await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Share reply' });
    } catch {
      /* user cancelled or sharing failed — no-op */
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.action} onPress={copy}>
        {copied ? 'Copied' : 'Copy'}
      </Text>
      <Text style={styles.action} onPress={exportReply}>
        Share
      </Text>
      {canRegenerate && onRegenerate ? (
        <Text style={styles.action} onPress={onRegenerate}>
          Regenerate
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs, paddingLeft: 2 },
    action: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  });
