// Renders web sources discovered during an answer as tappable chips (Visible web search).
import { memo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import type { Source } from '../storage/types';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SourcesListImpl({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Sources</Text>
      <View style={styles.chips}>
        {sources.map((s, i) => (
          <Text
            key={`${s.url}_${i}`}
            style={styles.chip}
            numberOfLines={1}
            onPress={() => Linking.openURL(s.url).catch(() => {})}
          >
            {i + 1}. {s.title?.trim() || hostOf(s.url)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export const SourcesList = memo(SourcesListImpl);

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs, fontWeight: '600' },
  chips: { gap: spacing.xs },
  chip: {
    color: colors.link,
    fontSize: 13,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    overflow: 'hidden',
  },
});
