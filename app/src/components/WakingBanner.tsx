// A small banner shown while the (possibly sleeping) server cold-starts, and while
// Claude is using web tools. Keeps the user informed instead of a silent wait.
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export function StatusBanner({ text }: { text: string }) {
  return (
    <View style={styles.bar}>
      <ActivityIndicator color={colors.accent} size="small" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  text: { color: colors.text, fontSize: 13 },
});
