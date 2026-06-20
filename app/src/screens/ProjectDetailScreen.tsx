// One project: edit its title, goal, and standing context instructions (injected into every
// chat in the project), and see / start its chats. New chats here are created with this
// project's id so they inherit its context (resolved in ChatScreen).
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  createConversation,
  getProject,
  listConversationsByProject,
  updateProject,
} from '../storage/db';
import { useTheme } from '../state/ThemeContext';
import { radius, spacing, type Colors } from '../theme';
import type { Conversation } from '../storage/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

export function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState(route.params.title ?? '');
  const [goal, setGoal] = useState('');
  const [contextPrompt, setContextPrompt] = useState('');
  const [chats, setChats] = useState<Conversation[]>([]);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const p = await getProject(projectId);
    if (p) {
      setTitle(p.title);
      setGoal(p.goal ?? '');
      setContextPrompt(p.contextPrompt ?? '');
    }
    setChats(await listConversationsByProject(projectId));
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: title.trim() || 'Project' });
  }, [navigation, title]);

  const save = useCallback(async () => {
    await updateProject(projectId, {
      title: title.trim() || 'New project',
      goal,
      contextPrompt,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [projectId, title, goal, contextPrompt]);

  const newChat = useCallback(async () => {
    // Persist edits first so the new chat picks up the latest context.
    await updateProject(projectId, { title: title.trim() || 'New project', goal, contextPrompt });
    const conv = await createConversation({ projectId });
    navigation.navigate('Chat', { conversationId: conv.id, title: conv.title });
  }, [navigation, projectId, title, goal, contextPrompt]);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Project name</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Tax return 2026"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Goal (optional)</Text>
        <Text style={styles.caption}>A one-line reminder of what this project is for.</Text>
        <TextInput
          style={styles.input}
          value={goal}
          onChangeText={setGoal}
          placeholder="e.g. Prepare my self-assessment"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Project context</Text>
        <Text style={styles.caption}>
          Standing instructions and background injected into every chat in this project — e.g.
          “You are my UK tax assistant for the 2025/26 year; be precise with HMRC rules.”
        </Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={contextPrompt}
          onChangeText={setContextPrompt}
          multiline
          placeholder="Background and instructions shared by every chat here…"
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={styles.primary} onPress={save}>
          <Text style={styles.primaryText}>{saved ? 'Saved ✓' : 'Save'}</Text>
        </Pressable>

        <View style={styles.chatsHeader}>
          <Text style={styles.sectionTitle}>Chats</Text>
          <Pressable onPress={newChat} hitSlop={8}>
            <Text style={styles.newChat}>＋ New chat</Text>
          </Pressable>
        </View>

        {chats.length === 0 ? (
          <Text style={styles.caption}>No chats in this project yet.</Text>
        ) : (
          chats.map((c) => (
            <Pressable
              key={c.id}
              style={styles.chatRow}
              onPress={() => navigation.navigate('Chat', { conversationId: c.id, title: c.title })}
            >
              <Text style={styles.chatTitle} numberOfLines={1}>
                {c.title}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg * 3 },
    label: { color: c.textMuted, fontSize: 13, marginTop: spacing.md, fontWeight: '600' },
    caption: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    input: {
      backgroundColor: c.surface,
      borderRadius: radius.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: c.textStrong,
      fontSize: 15,
    },
    multiline: { minHeight: 120, textAlignVertical: 'top' },
    primary: {
      backgroundColor: c.accent,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    primaryText: { color: c.textOnAccent, fontSize: 16, fontWeight: '700' },
    chatsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg + spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingTop: spacing.lg,
    },
    sectionTitle: { color: c.textStrong, fontSize: 16, fontWeight: '700' },
    newChat: { color: c.accent, fontSize: 15, fontWeight: '600' },
    chatRow: {
      backgroundColor: c.surface,
      borderRadius: radius.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    chatTitle: { color: c.textStrong, fontSize: 15, fontWeight: '600' },
  });
