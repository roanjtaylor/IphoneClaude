// Streaming chat client. Uses expo/fetch (NOT the global fetch) because it exposes a
// readable response body on React Native, which is what lets us read the server's SSE
// stream chunk-by-chunk. The parsing loop mirrors TasteTrainer's web streamSSE.
import { fetch } from 'expo/fetch';
import { SERVER_URL, APP_SHARED_SECRET } from './config';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * POST the conversation and consume the SSE reply, calling `onDelta` with each chunk
 * of assistant text as it arrives. Resolves when the stream completes; throws on a
 * server error or a non-OK response.
 */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${SERVER_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-secret': APP_SHARED_SECRET,
    },
    body: JSON.stringify({ messages }),
  });

  // Pre-stream failures (validation, auth) come back as a normal JSON error, not SSE.
  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b?.error) message = b.error;
    } catch {
      /* non-JSON body — keep the status message */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let errorMessage: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; lines are `event:` and `data:`.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      const parsed = JSON.parse(data) as { text?: string; error?: string };
      if (event === 'delta') onDelta(parsed.text ?? '');
      else if (event === 'error') errorMessage = parsed.error;
      // `done` needs no handling — the loop ends when the stream closes.
    }
  }

  if (errorMessage) throw new Error(errorMessage);
}
