// Export a whole conversation as a Markdown file via the iOS share sheet. Mirrors the
// single-reply export in components/MessageActions.tsx (write a temp .md to the cache dir,
// then expo-sharing). Attachment bytes aren't embedded — we list their names — and each
// assistant turn's web sources are appended as a footnote list.
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { Message } from '../storage/types';

/** Build a readable Markdown transcript of the conversation. */
export function buildConversationMarkdown(title: string, messages: Message[]): string {
  const lines: string[] = [`# ${title || 'Chat'}`, ''];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    lines.push(m.role === 'user' ? '## You' : '## Claude');
    const atts = m.attachments ?? [];
    if (atts.length > 0) {
      lines.push(atts.map((a) => `*${a.type === 'image' ? '🖼' : '📄'} ${a.name}*`).join('  ·  '));
      lines.push('');
    }
    lines.push(m.content.trim().length > 0 ? m.content.trim() : '*(no text)*');
    if (m.sources && m.sources.length > 0) {
      lines.push('');
      lines.push('**Sources**');
      m.sources.forEach((s, i) => lines.push(`${i + 1}. ${s.title ? `${s.title} — ` : ''}${s.url}`));
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

/** Slugify a title into a safe filename stem. */
function slug(title: string): string {
  return (title || 'chat').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40) || 'chat';
}

/**
 * Write the conversation to a temp .md and open the share sheet. Falls back to copying the
 * Markdown to the clipboard if sharing isn't available. `stamp` is passed in (callers have a
 * timestamp) so this stays free of Date.now() side effects at module scope.
 */
export async function shareConversation(
  title: string,
  messages: Message[],
  stamp: number,
): Promise<void> {
  const md = buildConversationMarkdown(title, messages);
  try {
    if (!(await Sharing.isAvailableAsync())) {
      await Clipboard.setStringAsync(md);
      return;
    }
    const path = `${FileSystem.cacheDirectory}${slug(title)}-${stamp}.md`;
    await FileSystem.writeAsStringAsync(path, md);
    await Sharing.shareAsync(path, {
      mimeType: 'text/markdown',
      dialogTitle: 'Share conversation',
      UTI: 'net.daringfireball.markdown',
    });
  } catch {
    /* user cancelled or sharing failed — no-op */
  }
}
