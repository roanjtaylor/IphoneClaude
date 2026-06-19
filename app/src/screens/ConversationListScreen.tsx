// Home screen: the list of saved conversations (newest first), with new-chat, rename,
// and delete. Refreshes whenever it regains focus so titles/ordering stay current.
import { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useConversations } from '../hooks/useConversations';
import { useSettings } from '../state/SettingsContext';
import { pingHealth } from '../api';
import { colors, radius, spacing } from '../theme';
import type { Conversation } from '../storage/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ConversationList'>;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ConversationListScreen({ navigation }: Props) {
  const { conversations, loading, refresh, create, rename, remove } = useConversations();
  const { settings } = useSettings();

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void pingHealth({ serverUrl: settings.serverUrl });
    }, [refresh, settings.serverUrl]),
  );

  const newChat = useCallback(async () => {
    const conv = await create();
    navigation.navigate('Chat', { conversationId: conv.id, title: conv.title });
  }, [create, navigation]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={newChat} hitSlop={10}>
            <Text style={styles.headerBtn}>＋ New</Text>
          </TouchableOpacity>
        ),
        headerLeft: () => (
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={10}>
            <Text style={styles.headerBtn}>⚙</Text>
          </TouchableOpacity>
        ),
      });
    }, [navigation, newChat]),
  );

  const onLongPress = (conv: Conversation) => {
    Alert.alert(conv.title, undefined, [
      {
        text: 'Rename',
        onPress: () =>
          Alert.prompt?.('Rename chat', undefined, (text) => {
            if (text?.trim()) void rename(conv.id, text.trim());
          }, 'plain-text', conv.title),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete chat?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void remove(conv.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyWrap : styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('Chat', { conversationId: item.id, title: item.title })
            }
            onLongPress={() => onLongPress(item)}
          >
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.rowTime}>{relativeTime(item.updatedAt)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No chats yet.</Text>
              <Pressable style={styles.cta} onPress={newChat}>
                <Text style={styles.ctaText}>Start a new chat</Text>
              </Pressable>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md },
  emptyWrap: { flex: 1 },
  headerBtn: { color: colors.accent, fontSize: 16, fontWeight: '600', paddingHorizontal: 4 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTitle: { color: colors.textStrong, fontSize: 16, fontWeight: '600' },
  rowTime: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.textFaint, fontSize: 15 },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ctaText: { color: colors.textOnAccent, fontSize: 15, fontWeight: '600' },
});
