// The chat screen for one conversation. Wires useChat to the message list + composer,
// shows waking/searching banners, resolves per-chat config overrides from Settings, and
// fires a keep-warm ping so a sleeping server starts cold-starting immediately.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useChat } from '../hooks/useChat';
import { useSettings } from '../state/SettingsContext';
import { getConversation } from '../storage/db';
import { pingHealth, type ApiConfig } from '../api';
import { MessageBubble } from '../components/MessageBubble';
import { Composer } from '../components/Composer';
import { StatusBanner } from '../components/WakingBanner';
import { colors, spacing } from '../theme';
import type { Message } from '../storage/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { settings } = useSettings();
  const [convOverrides, setConvOverrides] = useState<{ model?: string; systemPrompt?: string }>({});
  const listRef = useRef<FlatList<Message>>(null);

  // Resolve config: per-chat override → global settings.
  const config: ApiConfig = {
    serverUrl: settings.serverUrl,
    appSharedSecret: settings.appSharedSecret,
    model: convOverrides.model || settings.model,
    systemPrompt: convOverrides.systemPrompt || settings.systemPrompt,
  };

  const onTitle = useCallback(
    (title: string) => navigation.setParams({ title }),
    [navigation],
  );

  const { messages, busy, error, waking, searching, send, stop, regenerate } = useChat(
    conversationId,
    config,
    onTitle,
  );

  // Load per-chat overrides + set the header title; warm the server.
  useEffect(() => {
    getConversation(conversationId).then((c) => {
      if (c) {
        setConvOverrides({ model: c.model, systemPrompt: c.systemPrompt });
        if (!route.params.title) navigation.setParams({ title: c.title });
      }
    });
    void pingHealth({ serverUrl: settings.serverUrl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: route.params.title ?? 'Chat' });
  }, [navigation, route.params.title]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  })();

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <FlatList
          ref={listRef}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              busy={busy}
              isLastAssistant={item.id === lastAssistantId}
              onRegenerate={regenerate}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Ask Claude anything.</Text>
            </View>
          }
          onContentSizeChange={scrollToEnd}
        />

        {waking ? <StatusBanner text="Waking Claude up…" /> : null}
        {searching ? (
          <StatusBanner
            text={searching.query ? `Searching the web: ${searching.query}` : 'Searching the web…'}
          />
        ) : null}

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Composer busy={busy} onSend={send} onStop={stop} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textFaint, fontSize: 15 },
  errorBar: { backgroundColor: colors.errorBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  errorText: { color: colors.errorText, fontSize: 13 },
});
