// Renders assistant Markdown richly: headings, bold/italic, lists, tables, blockquotes,
// inline code, links (tappable), images (capped to bubble width), and fenced code blocks
// (delegated to CodeBlock for highlight + copy). Pure-JS (react-native-markdown-display),
// safe in Expo Go on iOS 15.
import { memo, useMemo } from 'react';
import { Image, Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Markdown, { type RenderRules } from 'react-native-markdown-display';
import { useTheme } from '../state/ThemeContext';
import { radius, spacing, type Colors } from '../theme';
import { CodeBlock } from './CodeBlock';
import { SavableImage } from './SavableImage';

function MarkdownMessageImpl({ content }: { content: string }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const mdStyles = useMemo(() => makeMdStyles(colors), [colors]);
  const maxImg = Math.min(width * 0.72, 320);

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
      // Long-press to save (handled by SavableImage). Sized to the bubble width.
      return (
        <SavableImage
          key={node.key}
          uri={src}
          style={{ width: maxImg, height: maxImg, borderRadius: radius.card, marginVertical: spacing.sm }}
          resizeMode="contain"
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
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {content}
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
