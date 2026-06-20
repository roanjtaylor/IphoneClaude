// Renders assistant Markdown richly: headings, bold/italic, lists, tables, blockquotes,
// inline code, links (tappable), images (capped to bubble width), and fenced code blocks
// (delegated to CodeBlock for highlight + copy). Pure-JS (react-native-markdown-display),
// safe in Expo Go on iOS 15.
import { memo, useEffect, useMemo, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Markdown, { type RenderRules } from 'react-native-markdown-display';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../state/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { Source } from '../storage/types';
import { radius, spacing, type Colors } from '../theme';
import { CodeBlock } from './CodeBlock';
import { SavableImage } from './SavableImage';

/**
 * An image embedded in an assistant reply (Markdown `![alt](url)`). Sizes itself to the
 * image's natural aspect ratio (fitted to the bubble width) instead of a fixed square, and
 * if the URL can't be loaded (404, blocked host, not really an image) it degrades to a
 * tappable link rather than a blank box — so a reply image always reads as *something* useful.
 */
function MarkdownImage({
  uri,
  alt,
  maxWidth,
  colors,
  onPress,
}: {
  uri: string;
  alt?: string;
  maxWidth: number;
  colors: Colors;
  onPress: () => void;
}) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setRatio(null);
    setFailed(false);
    // getSize both measures the image and verifies it actually loads; its error path is our
    // signal to fall back to a link.
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setRatio(w / h);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  if (failed) {
    return (
      <Text
        style={{ color: colors.link, textDecorationLine: 'underline', marginVertical: spacing.sm }}
        onPress={() => Linking.openURL(uri).catch(() => {})}
      >
        🖼 {alt?.trim() || 'View image'}
      </Text>
    );
  }

  // Cap height so a very tall image can't dominate the bubble; fall back to a 3:2 box until
  // the real ratio is known.
  const height = ratio ? Math.min(maxWidth / ratio, maxWidth * 1.4) : maxWidth * 0.66;
  return (
    <SavableImage
      uri={uri}
      style={{ width: maxWidth, height, borderRadius: radius.card, marginVertical: spacing.sm }}
      resizeMode="contain"
      onPress={onPress}
    />
  );
}

/**
 * Turn bare `[n]` citation markers into tappable links (`claude-cite:n`, opened in
 * onLinkPress) when the message has sources. Code (fenced + inline) is protected so we never
 * rewrite things like `arr[1]` in a snippet, and we gate `n` to a real source index and skip
 * reference-link definitions (`[1]:`), `[text][1]` constructs, and Markdown image alt text
 * (`![1](url)`) — the leading-char rule excludes `!`, `]` and identifier chars.
 */
function linkifyCitations(content: string, sourceCount: number): string {
  if (sourceCount <= 0) return content;
  const codeOrProse = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`]*`)/g;
  return content
    .split(codeOrProse)
    .map((part, i) => {
      if (i % 2 === 1) return part; // captured code segment — leave untouched
      return part.replace(/(^|[\s.,;:?)])\[(\d{1,2})\](?!:)/g, (m, pre: string, num: string) => {
        const n = parseInt(num, 10);
        if (n < 1 || n > sourceCount) return m;
        return `${pre}[\\[${n}\\]](claude-cite:${n})`;
      });
    })
    .join('');
}

function MarkdownMessageImpl({ content, sources }: { content: string; sources?: Source[] }) {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const mdStyles = useMemo(() => makeMdStyles(colors), [colors]);
  // Reply images fit the bubble width (capped) and size to their own aspect ratio.
  const maxImg = Math.min(width * 0.78, 360);
  const body = useMemo(() => linkifyCitations(content, sources?.length ?? 0), [content, sources]);

  const rules: RenderRules = {
    fence: (node) => (
      <CodeBlock key={node.key} code={node.content} language={(node as any).sourceInfo?.trim()} />
    ),
    code_block: (node) => (
      <CodeBlock key={node.key} code={node.content} language={(node as any).sourceInfo?.trim()} />
    ),
    image: (node) => {
      const src = node.attributes?.src;
      if (!src) return null;
      // Aspect-ratio fit + link fallback; tap opens full-screen, long-press saves/shares.
      return (
        <MarkdownImage
          key={node.key}
          uri={src}
          alt={node.attributes?.alt}
          maxWidth={maxImg}
          colors={colors}
          onPress={() => navigation.navigate('ImageViewer', { uri: src })}
        />
      );
    },
    // Wrap tables in a horizontal scroll so wide ones aren't squashed into the bubble.
    table: (node, children) => (
      <ScrollView
        key={node.key}
        horizontal
        showsHorizontalScrollIndicator
        style={mdStyles.tableScroll}
      >
        <View style={mdStyles.table}>{children}</View>
      </ScrollView>
    ),
  };

  return (
    <Markdown
      style={mdStyles}
      rules={rules}
      onLinkPress={(url) => {
        const cite = url.match(/^claude-cite:(\d+)$/);
        if (cite) {
          const s = sources?.[parseInt(cite[1], 10) - 1];
          if (s) Linking.openURL(s.url).catch(() => {});
          return false;
        }
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {body}
    </Markdown>
  );
}

export const MarkdownMessage = memo(MarkdownMessageImpl);

// react-native-markdown-display style map, themed to match the active Claude palette.
const makeMdStyles = (c: Colors) =>
  StyleSheet.create({
    body: { color: c.text, fontSize: 16, lineHeight: 22 },
    heading1: { color: c.textStrong, fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    heading2: { color: c.textStrong, fontSize: 19, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    heading3: { color: c.textStrong, fontSize: 17, fontWeight: '700', marginTop: 6, marginBottom: 4 },
    heading4: { color: c.textStrong, fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 2 },
    heading5: { color: c.textStrong, fontSize: 15, fontWeight: '700' },
    heading6: { color: c.textStrong, fontSize: 14, fontWeight: '700' },
    strong: { fontWeight: '700', color: c.textStrong },
    em: { fontStyle: 'italic' },
    link: { color: c.link, textDecorationLine: 'underline' },
    blockquote: {
      backgroundColor: c.surfaceAlt,
      borderLeftColor: c.accent,
      borderLeftWidth: 3,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginVertical: spacing.xs,
      borderRadius: 4,
    },
    bullet_list: { marginVertical: spacing.xs },
    ordered_list: { marginVertical: spacing.xs },
    list_item: { marginVertical: 2, flexDirection: 'row' },
    code_inline: {
      backgroundColor: c.codeBg,
      color: c.codeText,
      fontFamily: 'Courier',
      fontSize: 14,
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    hr: { backgroundColor: c.border, height: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
    tableScroll: { marginVertical: spacing.sm },
    table: { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: 6 },
    thead: { backgroundColor: c.surfaceAlt },
    // flex:0 overrides the lib's default flex:1 (which, inside a horizontal ScrollView,
    // would collapse columns); minWidth keeps them legible and gives the row an intrinsic
    // width to scroll.
    th: { flex: 0, padding: spacing.sm, color: c.textStrong, fontWeight: '700', minWidth: 110 },
    td: { flex: 0, padding: spacing.sm, color: c.text, borderColor: c.border, minWidth: 110 },
    tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  });
