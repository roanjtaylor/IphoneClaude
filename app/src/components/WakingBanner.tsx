// A small banner shown while the (possibly sleeping) server cold-starts, and while
// Claude is using web tools. Keeps the user informed instead of a silent wait.
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { spacing, type Colors } from '../theme';

export function StatusBanner({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
      <ActivityIndicator color={colors.accent} size="small" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: c.surfaceAlt,
    },
    text: { color: c.text, fontSize: 13 },
  });
