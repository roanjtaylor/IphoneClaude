// Renders assistant Markdown richly: headings, bold/italic, lists, tables, blockquotes,
// inline code, links (tappable), images (capped to bubble width), and fenced code blocks
// (delegated to CodeBlock for highlight + copy). Pure-JS (react-native-markdown-display),
// safe in Expo Go on iOS 15.
import { memo } from 'react';
import { Image, Linking, StyleSheet, useWindowDimensions } from 'react-native';
import Markdown, { type RenderRules } from 'react-native-markdown-display';
import { colors, radius, spacing } from '../theme';
import { CodeBlock } from './CodeBlock';

function MarkdownMessageImpl({ content }: { content: string }) {
  const { width } = useWindowDimensions();
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
      return (
        <Image
          key={node.key}
          source={{ uri: src }}
          style={{ width: maxImg, height: maxImg, borderRadius: radius.card, marginVertical: spacing.sm }}
          resizeMode="contain"
        />
      );
    },
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

// react-native-markdown-display style map, themed to match the dark Claude UI.
const mdStyles = StyleSheet.create({
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  heading1: { color: colors.textStrong, fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  heading2: { color: colors.textStrong, fontSize: 19, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  heading3: { color: colors.textStrong, fontSize: 17, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  heading4: { color: colors.textStrong, fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  heading5: { color: colors.textStrong, fontSize: 15, fontWeight: '700' },
  heading6: { color: colors.textStrong, fontSize: 14, fontWeight: '700' },
  strong: { fontWeight: '700', color: colors.textStrong },
  em: { fontStyle: 'italic' },
  link: { color: colors.link, textDecorationLine: 'underline' },
  blockquote: {
    backgroundColor: colors.surfaceAlt,
    borderLeftColor: colors.accent,
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
    backgroundColor: colors.codeBg,
    color: '#e6b3a0',
    fontFamily: 'Courier',
    fontSize: 14,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  hr: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
  table: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 6, marginVertical: spacing.sm },
  thead: { backgroundColor: colors.surfaceAlt },
  th: { padding: spacing.sm, color: colors.textStrong, fontWeight: '700' },
  td: { padding: spacing.sm, color: colors.text, borderColor: colors.border },
  tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
