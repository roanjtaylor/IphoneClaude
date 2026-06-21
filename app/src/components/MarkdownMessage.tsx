// Renders assistant Markdown richly: headings, bold/italic, lists, tables, blockquotes,
// inline code, links (tappable), images (capped to bubble width), and fenced code blocks
// (delegated to CodeBlock for highlight + copy). Pure-JS (react-native-markdown-display),
// safe in Expo Go on iOS 15.
import { memo, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Markdown, { type RenderRules } from 'react-native-markdown-display';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../state/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { Source } from '../storage/types';
import { radius, spacing, type Colors } from '../theme';
import { CodeBlock } from './CodeBlock';
import { SavableImage } from './SavableImage';

function MarkdownImage({
  uri,
  maxWidth,
  colors,
  onPress,
}: {
  uri: string;
  maxWidth: number;
  colors: Colors;
  onPress: () => void;
}) {
  const [ratio, setRatio] = useState<number | null>(null);

  // Always attempt to render the image — a surfaceAlt background acts as placeholder while
  // loading, and as a subtle indicator if the URL fails. Never fall back to a text link here:
  // that hides images that would have loaded (e.g. the Image.getSize path is unreliable for
  // remote URLs). If Claude embedded an invalid URL the worst outcome is a quiet grey box.
  const height = ratio ? Math.min(maxWidth / ratio, maxWidth * 1.4) : maxWidth * 0.66;
  return (
    <SavableImage
      uri={uri}
      style={{
        width: maxWidth,
        height,
        borderRadius: radius.card,
        marginVertical: spacing.sm,
        backgroundColor: colors.surfaceAlt,
      }}
      resizeMode="contain"
      onPress={onPress}
      onLoad={(e) => {
        const { width: w, height: h } = e.nativeEvent.source;
        if (w > 0 && h > 0) setRatio(w / h);
      }}
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
          maxWidth={maxImg}
          colors={colors}
          onPress={() => navigation.navigate('ImageViewer', { uri: src })}
        />
      );
    },
    // No custom `table` rule: the library default renders a plain View, which participates
    // in the flex column layout like any other block — no height gaps, no ScrollView bugs.
    // Tables that are wider than the bubble will overflow (rare in practice for 2–4 columns
    // on this app's content), which is far preferable to the blank-page glitch.
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
    // Table: plain View layout — the library default renders table/thead/tbody/tr/th/td as
    // Views with flexDirection:'row' on tr, so cells naturally tile horizontally.
    // overflow:'hidden' clips cell content to the table's borderRadius corners.
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 6,
      overflow: 'hidden',
      marginVertical: spacing.sm,
    },
    thead: { backgroundColor: c.surfaceAlt },
    tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, flexDirection: 'row' },
    // flex:1 (library default) lets cells share row width equally. No minWidth so narrow
    // tables don't overflow; text inside wraps naturally.
    th: { flex: 1, padding: spacing.sm },
    td: { flex: 1, padding: spacing.sm },
  });
