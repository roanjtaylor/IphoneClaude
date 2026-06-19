// Core chat engine for a single conversation: load history, send (with attachments),
// stream the reply, stop mid-flight, regenerate. Persists to SQLite on completion (not
// per-delta). Surfaces "waking up" and "searching the web" states for the UI.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTitle,
  streamChat,
  type ApiConfig,
  type Source,
  type WireAttachment,
  type WireMessage,
} from '../api';
import {
  appendMessage,
  deleteMessagesFrom,
  getMessages,
  renameConversation,
  updateMessage,
} from '../storage/db';
import { toBase64 } from '../storage/attachments';
import type { Attachment, Message } from '../storage/types';
import { newId } from '../storage/id';

const WAKE_DELAY_MS = 3000;

type SendArgs = { text: string; attachments?: Attachment[] };

export function useChat(
  conversationId: string,
  config: ApiConfig,
  onTitle?: (title: string) => void,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const [searching, setSearching] = useState<{ name: string; query?: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest config without re-creating callbacks each keystroke.
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let alive = true;
    getMessages(conversationId).then((m) => {
      if (alive) setMessages(m);
    });
    return () => {
      alive = false;
    };
  }, [conversationId]);

  const clearWakeTimer = () => {
    if (wakeTimerRef.current) {
      clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
  };

  // Turn on-disk attachments into base64 wire form at send time (never persisted).
  const toWire = useCallback(async (history: Message[]): Promise<WireMessage[]> => {
    const out: WireMessage[] = [];
    for (const m of history) {
      let attachments: WireAttachment[] | undefined;
      if (m.attachments && m.attachments.length > 0) {
        attachments = [];
        for (const a of m.attachments) {
          try {
            const data = await toBase64(a.uri);
            attachments.push({ type: a.type, mediaType: a.mediaType, data });
          } catch {
            /* skip an unreadable file rather than failing the whole turn */
          }
        }
      }
      out.push({ role: m.role, content: m.content, attachments });
    }
    return out;
  }, []);

  /** Run a streamed assistant turn over `history` (which already ends at the user turn). */
  const runAssistant = useCallback(
    async (history: Message[], isFirstExchange: boolean) => {
      setBusy(true);
      setError(null);
      setSearching(null);

      const assistantLocalId = newId('msg');
      const placeholder: Message = {
        id: assistantLocalId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
      };
      setMessages([...history, placeholder]);

      const controller = new AbortController();
      abortRef.current = controller;

      // Only show "waking up…" if the (possibly sleeping) server is slow to respond —
      // not on every message. Cleared as soon as the first byte arrives (onOpen).
      wakeTimerRef.current = setTimeout(() => setWaking(true), WAKE_DELAY_MS);

      let collected = '';
      const collectedSources: Source[] = [];

      const patchAssistant = (patch: Partial<Message>) =>
        setMessages((prev) => {
          const next = prev.slice();
          const i = next.findIndex((m) => m.id === assistantLocalId);
          if (i >= 0) next[i] = { ...next[i], ...patch };
          return next;
        });

      try {
        const wire = await toWire(history);
        await streamChat(
          wire,
          configRef.current,
          {
            onOpen: () => {
              clearWakeTimer();
              setWaking(false);
            },
            onDelta: (text) => {
              collected += text;
              patchAssistant({ content: collected });
            },
            onTool: (info) => setSearching(info),
            onSources: (sources) => {
              collectedSources.splice(0, collectedSources.length, ...sources);
              patchAssistant({ sources: [...sources] });
            },
          },
          controller.signal,
        );

        // Success — persist the finished assistant turn once.
        patchAssistant({ status: 'complete' });
        await appendMessage({
          id: assistantLocalId,
          conversationId,
          role: 'assistant',
          content: collected,
          sources: collectedSources.length ? collectedSources : undefined,
          status: 'complete',
        });

        // Auto-title after the first real exchange.
        if (isFirstExchange && collected.trim().length > 0) {
          const firstUser = history.find((m) => m.role === 'user');
          if (firstUser) {
            const title = await fetchTitle(firstUser.content, collected, configRef.current);
            if (title) {
              await renameConversation(conversationId, title);
              onTitle?.(title);
            }
          }
        }
      } catch (e: any) {
        const aborted = controller.signal.aborted;
        if (collected.trim().length > 0) {
          // Commit whatever streamed (stop button / dropped connection mid-answer).
          patchAssistant({ status: 'complete' });
          await appendMessage({
            id: assistantLocalId,
            conversationId,
            role: 'assistant',
            content: collected,
            sources: collectedSources.length ? collectedSources : undefined,
            status: 'complete',
          });
        } else {
          // Nothing streamed — drop the placeholder.
          setMessages((prev) => prev.filter((m) => m.id !== assistantLocalId));
        }
        if (!aborted) setError(e?.message ?? 'Something went wrong.');
      } finally {
        clearWakeTimer();
        setWaking(false);
        setSearching(null);
        setBusy(false);
        abortRef.current = null;
      }
    },
    [conversationId, onTitle, toWire],
  );

  const send = useCallback(
    async ({ text, attachments }: SendArgs) => {
      const trimmed = text.trim();
      if ((!trimmed && !(attachments && attachments.length)) || busy) return;

      const userMsg = await appendMessage({
        conversationId,
        role: 'user',
        content: trimmed,
        attachments: attachments && attachments.length ? attachments : undefined,
        status: 'complete',
      });

      const isFirstExchange = messages.length === 0;
      const history = [...messages, userMsg];
      setMessages(history);
      await runAssistant(history, isFirstExchange);
    },
    [busy, conversationId, messages, runAssistant],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Re-run the most recent assistant turn (drops it and re-sends the prior user turn). */
  const regenerate = useCallback(async () => {
    if (busy) return;
    // Find the last assistant message and the user turn before it.
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx <= 0) return;
    const assistant = messages[lastAssistantIdx];
    // Truncate persisted + in-memory history back to (but excluding) that assistant turn.
    await deleteMessagesFrom(conversationId, assistant.createdAt);
    const history = messages.slice(0, lastAssistantIdx);
    setMessages(history);
    await runAssistant(history, history.length === 1);
  }, [busy, conversationId, messages, runAssistant]);

  return { messages, busy, error, waking, searching, send, stop, regenerate, setError };
}
