// SQLite persistence for conversations + messages. Per-message inserts (cheap on an
// old phone) instead of rewriting one big JSON blob. Attachments/sources are stored as
// JSON columns — fine at single-user scale. See plan: storage section.
import * as SQLite from 'expo-sqlite';
import { newId } from './id';
import { deleteAttachment } from './attachments';
import type { Attachment, Conversation, Message, Role, Source } from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('claude7.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          model TEXT,
          systemPrompt TEXT
        );
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY NOT NULL,
          conversationId TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          attachments TEXT,
          sources TEXT,
          status TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations (updatedAt DESC);
        CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversationId, createdAt ASC);
      `);
      return db;
    });
  }
  return dbPromise;
}

/** Call once at app start (App.tsx) so the schema exists before any screen reads it. */
export async function initDb(): Promise<void> {
  await getDb();
}

// ---- Conversations ---------------------------------------------------------

export async function listConversations(): Promise<Conversation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Conversation>(
    'SELECT * FROM conversations ORDER BY updatedAt DESC',
  );
  return rows;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Conversation>('SELECT * FROM conversations WHERE id = ?', id)) ?? null
  );
}

export async function createConversation(
  seed: Partial<Pick<Conversation, 'title' | 'model' | 'systemPrompt'>> = {},
): Promise<Conversation> {
  const db = await getDb();
  const now = Date.now();
  const conv: Conversation = {
    id: newId('conv'),
    title: seed.title ?? 'New chat',
    createdAt: now,
    updatedAt: now,
    model: seed.model,
    systemPrompt: seed.systemPrompt,
  };
  await db.runAsync(
    'INSERT INTO conversations (id, title, createdAt, updatedAt, model, systemPrompt) VALUES (?, ?, ?, ?, ?, ?)',
    conv.id,
    conv.title,
    conv.createdAt,
    conv.updatedAt,
    conv.model ?? null,
    conv.systemPrompt ?? null,
  );
  return conv;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE conversations SET title = ? WHERE id = ?', title, id);
}

export async function touchConversation(id: string, when = Date.now()): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE conversations SET updatedAt = ? WHERE id = ?', when, id);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb();
  // Clean up attachment files on disk before dropping the rows.
  const msgs = await getMessages(id);
  for (const m of msgs) {
    for (const a of m.attachments ?? []) {
      await deleteAttachment(a.uri).catch(() => {});
    }
  }
  await db.runAsync('DELETE FROM messages WHERE conversationId = ?', id);
  await db.runAsync('DELETE FROM conversations WHERE id = ?', id);
}

// ---- Messages --------------------------------------------------------------

type MessageRow = {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: number;
  attachments: string | null;
  sources: string | null;
  status: Message['status'] | null;
};

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    conversationId: r.conversationId,
    role: r.role,
    content: r.content,
    createdAt: r.createdAt,
    attachments: parseJson<Attachment[]>(r.attachments),
    sources: parseJson<Source[]>(r.sources),
    status: r.status ?? undefined,
  };
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC',
    conversationId,
  );
  return rows.map(rowToMessage);
}

export async function appendMessage(
  msg: Omit<Message, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): Promise<Message> {
  const db = await getDb();
  const full: Message = {
    ...msg,
    id: msg.id ?? newId('msg'),
    createdAt: msg.createdAt ?? Date.now(),
  };
  await db.runAsync(
    'INSERT INTO messages (id, conversationId, role, content, createdAt, attachments, sources, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    full.id,
    full.conversationId,
    full.role,
    full.content,
    full.createdAt,
    full.attachments ? JSON.stringify(full.attachments) : null,
    full.sources ? JSON.stringify(full.sources) : null,
    full.status ?? null,
  );
  await touchConversation(full.conversationId, full.createdAt);
  return full;
}

export async function updateMessage(
  id: string,
  patch: Partial<Pick<Message, 'content' | 'sources' | 'status' | 'attachments'>>,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: SQLite.SQLiteBindValue[] = [];
  if (patch.content !== undefined) {
    sets.push('content = ?');
    args.push(patch.content);
  }
  if (patch.sources !== undefined) {
    sets.push('sources = ?');
    args.push(patch.sources ? JSON.stringify(patch.sources) : null);
  }
  if (patch.attachments !== undefined) {
    sets.push('attachments = ?');
    args.push(patch.attachments ? JSON.stringify(patch.attachments) : null);
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    args.push(patch.status ?? null);
  }
  if (sets.length === 0) return;
  args.push(id);
  await db.runAsync(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`, ...args);
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM messages WHERE id = ?', id);
}

/** Delete a message and every message after it in the same chat (used by regenerate). */
export async function deleteMessagesFrom(conversationId: string, createdAt: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM messages WHERE conversationId = ? AND createdAt >= ?',
    conversationId,
    createdAt,
  );
}
