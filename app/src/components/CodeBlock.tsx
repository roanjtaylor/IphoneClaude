// A fenced code block: horizontally-scrollable, lightly syntax-highlighted, with a
// copy-code button and a language label. Highlighting is capped for big blocks to keep
// the iPhone 7 smooth (plan: perf cap).
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../theme';
import { tokenize } from './highlight';

const HIGHLIGHT_LIMIT = 3000; // chars; above this, render plain monospace.

function CodeBlockImpl({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const body = code.replace(/\n$/, '');
  const highlight = body.length <= HIGHLIGHT_LIMIT;

  const copy = async () => {
    await Clipboard.setStringAsync(body);
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.lang}>{language || 'code'}</Text>
        <Pressable onPress={copy} hitSlop={8}>
          <Text style={styles.copy}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.code} selectable>
          {highlight
            ? tokenize(body).map((t, i) => (
                <Text key={i} style={{ color: t.color }}>
                  {t.text}
                </Text>
              ))
            : body}
        </Text>
      </ScrollView>
    </View>
  );
}

export const CodeBlock = memo(CodeBlockImpl);

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.codeBg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lang: { color: colors.textMuted, fontSize: 12 },
  copy: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  scroll: { padding: spacing.md },
  code: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Courier',
  },
});
