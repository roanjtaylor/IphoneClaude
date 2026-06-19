// Runtime settings: server URL/secret, model, system prompt — overriding the build-time
// defaults without a rebuild. "Test connection" pings /api/health.
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../state/SettingsContext';
import { defaultSettings } from '../storage/settings';
import { MODEL_OPTIONS } from '../config';
import { pingHealth } from '../api';
import { colors, radius, spacing } from '../theme';

export function SettingsScreen() {
  const { settings, update, reset } = useSettings();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [secret, setSecret] = useState(settings.appSharedSecret);
  const [model, setModel] = useState(settings.model);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await update({
      serverUrl: serverUrl.trim().replace(/\/$/, ''),
      appSharedSecret: secret.trim(),
      model,
      systemPrompt,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const test = async () => {
    setTesting(true);
    const ok = await pingHealth({ serverUrl: serverUrl.trim().replace(/\/$/, '') });
    setTesting(false);
    Alert.alert(ok ? 'Connected' : 'No response', ok ? 'Server is reachable.' : 'Could not reach the server.');
  };

  const doReset = () =>
    Alert.alert('Reset settings?', 'Restore the built-in defaults.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await reset();
          const d = defaultSettings();
          setServerUrl(d.serverUrl);
          setSecret(d.appSharedSecret);
          setModel(d.model);
          setSystemPrompt(d.systemPrompt);
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Shared secret</Text>
        <TextInput
          style={styles.input}
          value={secret}
          onChangeText={setSecret}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="x-app-secret"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Model</Text>
        <View style={styles.models}>
          {MODEL_OPTIONS.map((m) => (
            <Pressable
              key={m.value}
              style={[styles.modelChip, model === m.value && styles.modelChipActive]}
              onPress={() => setModel(m.value)}
            >
              <Text style={[styles.modelText, model === m.value && styles.modelTextActive]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>System prompt (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          multiline
          placeholder="Leave blank to use the server default."
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={styles.primary} onPress={save}>
          <Text style={styles.primaryText}>{saved ? 'Saved ✓' : 'Save'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={test} disabled={testing}>
          <Text style={styles.secondaryText}>{testing ? 'Testing…' : 'Test connection'}</Text>
        </Pressable>
        <Pressable style={styles.reset} onPress={doReset}>
          <Text style={styles.resetText}>Reset to defaults</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textStrong,
    fontSize: 15,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  models: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modelChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modelChipActive: { borderColor: colors.accent },
  modelText: { color: colors.text, fontSize: 14 },
  modelTextActive: { color: colors.accent, fontWeight: '600' },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '700' },
  secondary: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  reset: { paddingVertical: spacing.md, alignItems: 'center' },
  resetText: { color: colors.textMuted, fontSize: 14 },
});
