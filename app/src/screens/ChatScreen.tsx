// The chat screen for one conversation. Wires useChat to the message list + composer,
// shows waking/searching banners, resolves per-chat config overrides from Settings, and
// fires a keep-warm ping so a sleeping server starts cold-starting immediately.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
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
import { getConversation, getProject, renameConversation } from '../storage/db';
import type { Message } from '../storage/types';
import { pingHealth, type ApiConfig } from '../api';
import { MessageBubble } from '../components/MessageBubble';
import { Composer } from '../components/Composer';
import { StatusBanner } from '../components/WakingBanner';
import { ClaudeMascot } from '../components/ClaudeMascot';
import { shareConversation } from '../lib/exportConversation';
import { spacing, type Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { settings } = useSettings();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerHeight = useHeaderHeight();
  const [convOverrides, setConvOverrides] = useState<{
    model?: string;
    systemPrompt?: string;
    projectContext?: string;
  }>({});
  const listRef = useRef<ScrollView>(null);
  // Latest messages for the header menu, without re-registering the header each delta.
  const messagesRef = useRef<Message[]>([]);
  // Track scroll Y so "Fit Width" can restore position instead of jumping to end.
  const scrollYRef = useRef(0);
  // Set to true just before a fit-width toggle; cleared in onContentSizeChange.
  const fitChangingRef = useRef(false);
  // Current iOS pinch-zoom scale, updated from onScroll events (zoomScale is iOS-only).
  const zoomScaleRef = useRef(1);

  // "Fit Width": null = default (padded) layout. A number = the content column width in
  // layout points, computed as screenWidth / zoomScale so the column fills the actual
  // visible area at whatever zoom the user has set — same font size, more text per line.
  const [fittedWidth, setFittedWidth] = useState<number | null>(null);
  const wide = fittedWidth !== null;

  // Resolve config: per-chat override → global settings.
  const config: ApiConfig = {
    serverUrl: settings.serverUrl,
    appSharedSecret: settings.appSharedSecret,
    model: convOverrides.model || settings.model,
    systemPrompt: convOverrides.systemPrompt || settings.systemPrompt,
    projectContext: convOverrides.projectContext,
  };

  const onTitle = useCallback((title: string) => navigation.setParams({ title }), [navigation]);

  const { messages, busy, error, waking, searching, send, stop, regenerate, continueReply } =
    useChat(conversationId, config, onTitle);

  // Load per-chat overrides + set the header title; warm the server.
  useEffect(() => {
    getConversation(conversationId).then(async (c) => {
      if (c) {
        // A chat in a project inherits the project's standing context.
        const project = c.projectId ? await getProject(c.projectId) : null;
        setConvOverrides({
          model: c.model,
          systemPrompt: c.systemPrompt,
          projectContext: project?.contextPrompt || undefined,
        });
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

  // "Fit Width": expand the content column to fill the visible area at the current zoom.
  // screenWidth / zoomScale gives the layout-point width that, when rendered at zoomScale,
  // exactly fills the screen — more text per line without changing font size.
  // fitChangingRef prevents onContentSizeChange from jumping to end during the reflow
  // (scrollToEnd doesn't account for native zoom scale → overshoots → blank screen).
  const toggleFit = useCallback(() => {
    fitChangingRef.current = true;
    if (fittedWidth !== null) {
      setFittedWidth(null);
    } else {
      const zoomScale = zoomScaleRef.current;
      const screenW = Dimensions.get('window').width;
      setFittedWidth(Math.round(screenW / zoomScale));
    }
  }, [fittedWidth]);

  const resetFit = useCallback(() => {
    fitChangingRef.current = true;
    setFittedWidth(null);
  }, []);

  // Keep the ref fresh so the header menu reads the latest transcript.
  messagesRef.current = messages;

  // Header overflow menu: Fit Width toggle + share the whole conversation as Markdown.
  const openMenu = useCallback(() => {
    Alert.alert('Chat options', undefined, [
      { text: wide ? 'Reset Fit' : 'Fit Width', onPress: toggleFit },
      {
        text: 'Share conversation',
        onPress: () => {
          const msgs = messagesRef.current;
          if (msgs.length === 0) {
            Alert.alert('Nothing to share', 'This chat is empty.');
            return;
          }
          void shareConversation(route.params.title ?? 'Chat', msgs, Date.now());
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [wide, toggleFit, route.params.title]);

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
        <Pressable onPress={openMenu} onLongPress={resetFit} hitSlop={8}>
          <Text style={styles.headerAction}>•••</Text>
        </Pressable>
      ),
    });
  }, [navigation, route.params.title, promptRename, openMenu, resetFit, wide, styles]);

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

  // Build the content container style.
  // flexGrow:1 is applied only for the empty state so the mascot centres vertically.
  // When messages exist, the container should be exactly as tall as its content — no
  // artificial padding — so after a "Fit Width" reflow the scroll view can't land in
  // blank space that doesn't correspond to any message.
  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      messages.length === 0 && styles.listContentGrow,
      fittedWidth !== null && { paddingHorizontal: 0, width: fittedWidth },
    ],
    [styles.listContent, messages.length, fittedWidth],
  );

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
          contentContainerStyle={listContentStyle}
          keyboardShouldPersistTaps="handled"
          // Pinch to zoom the conversation (iOS), like a web page. Min 0.5 = half size.
          minimumZoomScale={Platform.OS === 'ios' ? 0.5 : undefined}
          maximumZoomScale={Platform.OS === 'ios' ? 3 : undefined}
          bouncesZoom={Platform.OS === 'ios'}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
            // zoomScale is iOS-only; read it so toggleFit can compute the right width.
            const z = (e.nativeEvent as any).zoomScale;
            if (typeof z === 'number' && z > 0) zoomScaleRef.current = z;
          }}
          onContentSizeChange={() => {
            // After a "Fit Width" reflow: restore preserved position instead of jumping
            // to end. scrollToEnd() ignores native zoom scale → overshoots content
            // bounds → blank screen.
            if (fitChangingRef.current) {
              fitChangingRef.current = false;
              requestAnimationFrame(() =>
                listRef.current?.scrollTo({ x: 0, y: scrollYRef.current, animated: false })
              );
              return;
            }
            scrollToEnd();
          }}
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
                onContinue={continueReply}
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
    // No flexGrow here — content is exactly as tall as its messages (see listContentGrow).
    listContent: { padding: spacing.md, paddingBottom: spacing.lg },
    // Only applied for the empty state so the mascot centres within the scroll frame.
    listContentGrow: { flexGrow: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    emptyText: { color: c.textFaint, fontSize: 15 },
    errorBar: { backgroundColor: c.errorBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    errorText: { color: c.errorText, fontSize: 13 },
  });
