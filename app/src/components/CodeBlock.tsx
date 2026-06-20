// A fenced code block: horizontally-scrollable, lightly syntax-highlighted, with a
// copy-code button and a language label. Highlighting is capped for big blocks to keep
// the iPhone 7 smooth (plan: perf cap).
import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../state/ThemeContext';
import { radius, spacing, type Colors } from '../theme';
import { tokenize } from './highlight';

const HIGHLIGHT_LIMIT = 3000; // chars; above this, render plain monospace.
// Cap how tall a single code block may grow. A "markdown art" / ASCII-art reply is one
// huge fenced block; uncapped it stretches the white bubble down the whole screen, hiding
// the rest of the conversation (and the composer) below it. Capping the block and letting
// it scroll INTERNALLY closes the bubble so following messages render separately.
const MAX_BLOCK_HEIGHT = 360;

function CodeBlockImpl({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      {/* Vertical scroll caps the block's height (tall art/code scrolls inside the box);
          horizontal scroll keeps wide lines from being squashed. nestedScrollEnabled lets
          the inner scroll work within the outer conversation ScrollView. */}
      <ScrollView
        style={styles.vscroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
          <Text style={styles.code} selectable>
            {highlight
              ? tokenize(body, colors.codeText).map((t, i) => (
                  <Text key={i} style={{ color: t.color }}>
                    {t.text}
                  </Text>
                ))
              : body}
          </Text>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

export const CodeBlock = memo(CodeBlockImpl);

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: c.codeBg,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
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
      borderBottomColor: c.border,
    },
    lang: { color: c.textMuted, fontSize: 12 },
    copy: { color: c.accent, fontSize: 12, fontWeight: '600' },
    vscroll: { maxHeight: MAX_BLOCK_HEIGHT },
    scroll: { padding: spacing.md },
    code: {
      color: c.codeText,
      fontSize: 13,
      lineHeight: 19,
      fontFamily: 'Courier',
    },
  });
