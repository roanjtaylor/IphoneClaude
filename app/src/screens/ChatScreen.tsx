// The chat screen for one conversation. Wires useChat to the message list + composer,
// shows waking/searching banners, resolves per-chat config overrides from Settings, and
// fires a keep-warm ping so a sleeping server starts cold-starting immediately.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useChat } from '../hooks/useChat';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../state/ThemeContext';
import { getConversation, renameConversation } from '../storage/db';
import { pingHealth, type ApiConfig } from '../api';
import { MessageBubble } from '../components/MessageBubble';
import { Composer } from '../components/Composer';
import { StatusBanner } from '../components/WakingBanner';
import { ClaudeMascot } from '../components/ClaudeMascot';
import { spacing, type Colors } from '../theme';
import type { Message } from '../storage/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { settings } = useSettings();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

  // Tap the header title to rename the chat in place.
  const promptRename = useCallback(() => {
    const current = route.params.title ?? 'Chat';
    Alert.prompt?.(
      'Rename chat',
      undefined,
      (text) => {
        const name = text?.trim();
        if (!name) return;
        navigation.setParams({ title: name });
        void renameConversation(conversationId, name);
      },
      'plain-text',
      current,
    );
  }, [navigation, route.params.title, conversationId]);

  useLayoutEffect(() => {
    const title = route.params.title ?? 'Chat';
    navigation.setOptions({
      headerTitle: () => (
        <Pressable onPress={promptRename} hitSlop={8}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, route.params.title, promptRename, styles]);

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
          // Pinch to zoom the whole conversation (iOS), like a web page — lets you zoom
          // out to fit wide tables/code on screen, or zoom in to read. Min 0.5 = half size.
          minimumZoomScale={Platform.OS === 'ios' ? 0.5 : undefined}
          maximumZoomScale={Platform.OS === 'ios' ? 3 : undefined}
          bouncesZoom={Platform.OS === 'ios'}
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
              <ClaudeMascot size={88} color={colors.accent} />
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: c.bg },
    headerTitle: { color: c.textStrong, fontSize: 17, fontWeight: '600', maxWidth: 240 },
    listContent: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    emptyText: { color: c.textFaint, fontSize: 15 },
    errorBar: { backgroundColor: c.errorBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    errorText: { color: c.errorText, fontSize: 13 },
  });
