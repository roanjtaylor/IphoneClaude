import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { streamChat, type ChatMessage } from './src/api';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Chat />
    </SafeAreaProvider>
  );
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setInput('');

    // Conversation sent to the server = full history + this new user turn.
    const base: ChatMessage[] = [...messages, { role: 'user', content: text }];
    // Add an empty assistant bubble that we fill as deltas stream in.
    setMessages([...base, { role: 'assistant', content: '' }]);
    setBusy(true);
    scrollToEnd();

    try {
      await streamChat(base, (delta) => {
        setMessages((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        });
        scrollToEnd();
      });
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
      // Drop the empty placeholder if nothing ever streamed.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === '') return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  }, [input, busy, messages, scrollToEnd]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Claude</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <Bubble message={item} busy={busy} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Ask Claude anything.</Text>
            </View>
          }
          onContentSizeChange={scrollToEnd}
        />

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message Claude…"
            placeholderTextColor="#8a8a8a"
            multiline
            editable={!busy}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.send, (!input.trim() || busy) && styles.sendDisabled]}
            onPress={send}
            disabled={!input.trim() || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendText}>↑</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message, busy }: { message: ChatMessage; busy: boolean }) {
  const isUser = message.role === 'user';
  const empty = message.content.length === 0;
  return (
    <View style={[styles.bubbleRow, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {empty && busy ? (
          <ActivityIndicator color="#bbb" size="small" />
        ) : (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#1a1a1a' },
  header: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  headerTitle: { color: '#f5f5f5', fontSize: 17, fontWeight: '600' },
  listContent: { padding: 12, paddingBottom: 16, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#777', fontSize: 15 },
  bubbleRow: { marginVertical: 4, flexDirection: 'row' },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#d97757' },
  bubbleAssistant: { backgroundColor: '#2a2a2a' },
  bubbleText: { color: '#ececec', fontSize: 16, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  errorBar: { backgroundColor: '#5a1f1f', paddingHorizontal: 14, paddingVertical: 8 },
  errorText: { color: '#ffd7d7', fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: '#2a2a2a',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: '#f5f5f5',
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#d97757',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: '#444' },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 },
});
