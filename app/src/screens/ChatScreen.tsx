// The chat screen for one conversation. Wires useChat to the message list + composer,
// shows waking/searching banners, resolves per-chat config overrides from Settings, and
// fires a keep-warm ping so a sleeping server starts cold-starting immediately.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
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
import type { Message } from '../storage/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { settings } = useSettings();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerHeight = useHeaderHeight();
  const [convOverrides, setConvOverrides] = useState<{ model?: string; systemPrompt?: string }>({});
  const listRef = useRef<FlatList<Message>>(null);

  // "Update Fit": bake the current pinch-zoom into a persistent layout scale so the
  // conversation re-flows to fill the (zoomed) width at the same on-screen font size,
  // instead of staying a shrunken, narrow column. `fitScale` < 1 = more content fits.
  const [fitScale, setFitScale] = useState(1);
  const [fitKey, setFitKey] = useState(0); // bump to remount the list (resets live zoom)
  const [box, setBox] = useState<LayoutRectangle | null>(null);
  const zoomRef = useRef(1);

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

  // Bake the live pinch-zoom into the layout (long-press resets to normal).
  const updateFit = useCallback(() => {
    const z = zoomRef.current || 1;
    setFitScale((prev) => Math.max(0.5, Math.min(1.5, Math.round(prev * z * 100) / 100)));
    zoomRef.current = 1;
    setFitKey((k) => k + 1);
  }, []);

  const resetFit = useCallback(() => {
    zoomRef.current = 1;
    setFitScale(1);
    setFitKey((k) => k + 1);
  }, []);

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
      headerRight:
        Platform.OS === 'ios'
          ? () => (
              <Pressable onPress={updateFit} onLongPress={resetFit} hitSlop={8}>
                <Text style={styles.headerAction}>Update Fit</Text>
              </Pressable>
            )
          : undefined,
    });
  }, [navigation, route.params.title, promptRename, updateFit, resetFit, styles]);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);

  // When the keyboard opens to type a follow-up, re-pin to the bottom so the latest
  // messages aren't left hidden behind the input bar.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => scrollToEnd(true));
    return () => sub.remove();
  }, [scrollToEnd]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const z = e.nativeEvent.zoomScale;
    if (typeof z === 'number' && z > 0) zoomRef.current = z;
  }, []);

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  })();

  const list = (
    <FlatList
      key={fitKey}
      ref={listRef}
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      // Pinch to zoom the conversation (iOS), like a web page; then "Update Fit" re-flows
      // it to that width. Min 0.5 = half size.
      minimumZoomScale={Platform.OS === 'ios' ? 0.5 : undefined}
      maximumZoomScale={Platform.OS === 'ios' ? 3 : undefined}
      bouncesZoom={Platform.OS === 'ios'}
      onScroll={onScroll}
      scrollEventThrottle={16}
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
      onContentSizeChange={() => scrollToEnd()}
    />
  );

  // When a fit-scale is active, render the list into an oversized box scaled down from the
  // top-left so it visually fills the width but lays out (and wraps) at the wider size.
  const scaled = Platform.OS === 'ios' && fitScale !== 1 && box;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <View style={styles.fitClip} onLayout={(e) => setBox(e.nativeEvent.layout)}>
          {scaled ? (
            <View
              style={{
                width: box!.width / fitScale,
                height: box!.height / fitScale,
                transform: [{ scale: fitScale }],
                transformOrigin: 'top left',
              }}
            >
              {list}
            </View>
          ) : (
            list
          )}
        </View>

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
    fitClip: { flex: 1, overflow: 'hidden' },
    screen: { flex: 1, backgroundColor: c.bg },
    headerTitle: { color: c.textStrong, fontSize: 17, fontWeight: '600', maxWidth: 220 },
    headerAction: { color: c.accent, fontSize: 15, fontWeight: '600' },
    listContent: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    emptyText: { color: c.textFaint, fontSize: 15 },
    errorBar: { backgroundColor: c.errorBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    errorText: { color: c.errorText, fontSize: 13 },
  });
