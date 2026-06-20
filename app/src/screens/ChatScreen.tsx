// The chat screen for one conversation. Wires useChat to the message list + composer,
// shows waking/searching banners, resolves per-chat config overrides from Settings, and
// fires a keep-warm ping so a sleeping server starts cold-starting immediately.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { settings } = useSettings();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerHeight = useHeaderHeight();
  const [convOverrides, setConvOverrides] = useState<{ model?: string; systemPrompt?: string }>({});
  const listRef = useRef<ScrollView>(null);

  // "Update Fit": a pure layout reflow. When on, the conversation drops its side margins and
  // bubbles widen to the full screen width — same font size, just more text per line (a more
  // compact view). It's a real layout change (not a transform), so it never blanks content.
  const [wide, setWide] = useState(false);

  // Resolve config: per-chat override → global settings.
  const config: ApiConfig = {
    serverUrl: settings.serverUrl,
    appSharedSecret: settings.appSharedSecret,
    model: convOverrides.model || settings.model,
    systemPrompt: convOverrides.systemPrompt || settings.systemPrompt,
  };

  const onTitle = useCallback((title: string) => navigation.setParams({ title }), [navigation]);

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

  // Toggle the full-width reflow; long-press resets to the normal margined view.
  const toggleFit = useCallback(() => setWide((w) => !w), []);
  const resetFit = useCallback(() => setWide(false), []);

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
      headerRight: () => (
        <Pressable onPress={toggleFit} onLongPress={resetFit} hitSlop={8}>
          <Text style={styles.headerAction}>{wide ? 'Reset Fit' : 'Fit Width'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, route.params.title, promptRename, toggleFit, resetFit, wide, styles]);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);

  // When the keyboard opens to type a follow-up, re-pin to the bottom so the latest
  // messages aren't left hidden behind the input bar.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => scrollToEnd(true));
    return () => sub.remove();
  }, [scrollToEnd]);

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  })();

  // A plain ScrollView (not a virtualized FlatList): pinch-zoom on iOS interferes with
  // FlatList's windowing, which left messages below the first screen blank even though you
  // could scroll to them. A ScrollView renders every bubble, so scrolled content always shows,
  // and its native pinch-zoom is reliable.
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView
          ref={listRef}
          style={styles.flex}
          contentContainerStyle={[styles.listContent, wide && styles.listContentWide]}
          keyboardShouldPersistTaps="handled"
          // Pinch to zoom the conversation (iOS), like a web page. Min 0.5 = half size.
          minimumZoomScale={Platform.OS === 'ios' ? 0.5 : undefined}
          maximumZoomScale={Platform.OS === 'ios' ? 3 : undefined}
          bouncesZoom={Platform.OS === 'ios'}
          onContentSizeChange={() => scrollToEnd()}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <ClaudeMascot size={88} color={colors.accent} />
              <Text style={styles.emptyText}>Ask Claude anything.</Text>
            </View>
          ) : (
            messages.map((item) => (
              <MessageBubble
                key={item.id}
                message={item}
                busy={busy}
                wide={wide}
                isLastAssistant={item.id === lastAssistantId}
                onRegenerate={regenerate}
              />
            ))
          )}
        </ScrollView>

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
    headerTitle: { color: c.textStrong, fontSize: 17, fontWeight: '600', maxWidth: 220 },
    headerAction: { color: c.accent, fontSize: 15, fontWeight: '600' },
    listContent: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
    // Full-width reflow: drop the side margins so bubbles use the whole screen width.
    listContentWide: { paddingHorizontal: spacing.xs },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    emptyText: { color: c.textFaint, fontSize: 15 },
    errorBar: { backgroundColor: c.errorBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    errorText: { color: c.errorText, fontSize: 13 },
  });
