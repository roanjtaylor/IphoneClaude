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
  touchConversation,
  updateMessage,
} from '../storage/db';
import { toBase64 } from '../storage/attachments';
import type { Attachment, Message } from '../storage/types';
import { newId } from '../storage/id';

const WAKE_DELAY_MS = 3000;
// Cap the total base64 attachment payload across the WHOLE request. The server is
// stateless, so we resend every turn's image/document bytes each time (that's what keeps
// past images in context). A long, image-heavy chat could otherwise blow the server's
// 15 MB body limit and 413; we keep the newest attachments within this budget and drop
// older ones with a note. base64 inflates ~33%, so 12 MB of base64 leaves headroom.
const MAX_WIRE_BASE64 = 12 * 1024 * 1024;

// A transient user turn appended to the wire (only) when resuming a stopped reply, so the
// model continues its previous answer. Never persisted or shown.
const CONTINUE_TURN: WireMessage = {
  role: 'user',
  content:
    'Continue your previous response from exactly where it stopped. Do not repeat or restate anything you already wrote — just keep going seamlessly.',
};

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

  // Turn on-disk attachments into base64 wire form at send time (never persisted). The full
  // history — including every past turn's attachments — is resent so the model keeps earlier
  // images/files in context. To stay under the server body limit, walk newest-first and keep
  // attachments within MAX_WIRE_BASE64; any older ones beyond the budget are dropped with a
  // short note in that turn's text.
  const toWire = useCallback(async (history: Message[]): Promise<WireMessage[]> => {
    const encoded = await Promise.all(
      history.map(async (m) => {
        const atts: WireAttachment[] = [];
        for (const a of m.attachments ?? []) {
          try {
            atts.push({ type: a.type, mediaType: a.mediaType, data: await toBase64(a.uri) });
          } catch {
            /* skip an unreadable file rather than failing the whole turn */
          }
        }
        return { role: m.role, content: m.content, atts };
      }),
    );

    const out: WireMessage[] = encoded.map((e) => ({ role: e.role, content: e.content }));
    let used = 0;
    for (let i = encoded.length - 1; i >= 0; i--) {
      const { atts } = encoded[i];
      if (atts.length === 0) continue;
      const kept: WireAttachment[] = [];
      let droppedHere = 0;
      for (const a of atts) {
        if (used + a.data.length <= MAX_WIRE_BASE64) {
          used += a.data.length;
          kept.push(a);
        } else {
          droppedHere++;
        }
      }
      if (kept.length > 0) out[i].attachments = kept;
      if (droppedHere > 0) {
        const note = `(${droppedHere} earlier attachment${droppedHere > 1 ? 's' : ''} omitted to stay within the size limit)`;
        out[i].content = out[i].content ? `${out[i].content}\n\n${note}` : note;
        console.warn(`[chat] dropped ${droppedHere} attachment(s) from an earlier turn to fit the wire budget.`);
      }
    }
    return out;
  }, []);

  /**
   * Run a streamed assistant turn.
   *  - `mode: 'new'` (default): append a fresh assistant turn over `history` (which already
   *    ends at the user turn). On Stop with partial text, the turn is saved as 'stopped'.
   *  - `mode: 'continue'`: resume the existing (stopped) `target` message in place — seed the
   *    stream with its current content/sources, send the history followed by a transient
   *    "keep going" user turn (never persisted/visible), append new deltas into the SAME
   *    bubble, and UPDATE the row on completion. No auto-title.
   */
  const runAssistant = useCallback(
    async (
      history: Message[],
      isFirstExchange: boolean,
      resume?: { target: Message },
    ) => {
      setBusy(true);
      setError(null);
      setSearching(null);

      const resuming = !!resume;
      const assistantLocalId = resume ? resume.target.id : newId('msg');

      if (resume) {
        // Keep the stopped bubble; flip it back to streaming and continue filling it.
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantLocalId ? { ...m, status: 'streaming' } : m)),
        );
      } else {
        const placeholder: Message = {
          id: assistantLocalId,
          conversationId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          status: 'streaming',
        };
        setMessages([...history, placeholder]);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // Only show "waking up…" if the (possibly sleeping) server is slow to respond —
      // not on every message. Cleared as soon as the first byte arrives (onOpen).
      wakeTimerRef.current = setTimeout(() => setWaking(true), WAKE_DELAY_MS);

      let collected = resume ? resume.target.content : '';
      // Seed from the stopped turn's sources so a continuation merges with them, not replaces.
      const collectedSources: Source[] = resume?.target.sources ? [...resume.target.sources] : [];

      const patchAssistant = (patch: Partial<Message>) =>
        setMessages((prev) => {
          const next = prev.slice();
          const i = next.findIndex((m) => m.id === assistantLocalId);
          if (i >= 0) next[i] = { ...next[i], ...patch };
          return next;
        });

      // Persist: a new turn INSERTs; a continued turn UPDATEs the existing row.
      const persist = async (status: Message['status']) => {
        const sources = collectedSources.length ? collectedSources : undefined;
        if (resuming) {
          await updateMessage(assistantLocalId, { content: collected, sources, status });
          await touchConversation(conversationId);
        } else {
          await appendMessage({
            id: assistantLocalId,
            conversationId,
            role: 'assistant',
            content: collected,
            sources,
            status,
          });
        }
      };

      try {
        const baseWire = await toWire(history);
        const wire = resume ? [...baseWire, CONTINUE_TURN] : baseWire;
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
              // Union by URL so a continuation keeps the stopped turn's earlier sources.
              const byUrl = new Map(collectedSources.map((s) => [s.url, s]));
              for (const s of sources) if (!byUrl.has(s.url)) byUrl.set(s.url, s);
              const merged = [...byUrl.values()];
              collectedSources.splice(0, collectedSources.length, ...merged);
              patchAssistant({ sources: [...merged] });
            },
          },
          controller.signal,
        );

        // Success — persist the finished assistant turn once.
        patchAssistant({ status: 'complete' });
        await persist('complete');

        // Auto-title after the first real exchange (never on a continuation).
        if (!resuming && isFirstExchange && collected.trim().length > 0) {
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
          // A user Stop becomes 'stopped' (offers Retry/Continue); a dropped connection
          // mid-answer commits what streamed as 'complete'.
          const status: Message['status'] = aborted ? 'stopped' : 'complete';
          patchAssistant({ status });
          await persist(status);
        } else if (resuming) {
          // Nothing new streamed on a continue — leave the stopped turn as it was.
          patchAssistant({ status: 'stopped' });
        } else {
          // Nothing streamed at all — drop the placeholder.
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

  /** Resume a stopped reply in place (keeps the partial text, continues the same bubble). */
  const continueReply = useCallback(async () => {
    if (busy) return;
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx < 0) return;
    const target = messages[lastAssistantIdx];
    if (target.status !== 'stopped') return;
    // History through and including the stopped turn; the wire adds CONTINUE_TURN.
    const history = messages.slice(0, lastAssistantIdx + 1);
    await runAssistant(history, false, { target });
  }, [busy, messages, runAssistant]);

  return { messages, busy, error, waking, searching, send, stop, regenerate, continueReply, setError };
}
