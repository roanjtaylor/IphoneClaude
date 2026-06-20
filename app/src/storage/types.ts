// Shared data model for persisted chats. Conversations + messages live in SQLite
// (storage/db.ts); attachment bytes live on disk (storage/attachments.ts) with only
// their uri/metadata stored on the message.

export type Role = 'user' | 'assistant';

// 'stopped' = the user pressed Stop with a partial reply already streamed (distinct from
// 'complete' so the UI can offer Retry / Continue on it).
export type MessageStatus = 'streaming' | 'complete' | 'error' | 'stopped';

/** A file attached to a user turn. Bytes are on disk at `uri`; base64 is produced on
 * demand at send time and never persisted. */
export type Attachment = {
  id: string;
  type: 'image' | 'document';
  /** file:// uri inside the app's document directory. */
  uri: string;
  /** e.g. "image/jpeg", "application/pdf". */
  mediaType: string;
  name: string;
};

/** A web source surfaced while answering (rendered as a tappable link). */
export type Source = {
  url: string;
  title?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: number;
  attachments?: Attachment[];
  sources?: Source[];
  status?: MessageStatus;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Optional per-chat overrides (fall back to global Settings). */
  model?: string;
  systemPrompt?: string;
  /** Parent project (its context is injected into this chat). */
  projectId?: string;
};

/** A project groups chats under a shared goal + standing context instructions. */
export type Project = {
  id: string;
  title: string;
  /** A short statement of the project's overall goal (for the user; not sent to Claude). */
  goal?: string;
  /** Standing context injected into every child chat's system prompt. */
  contextPrompt?: string;
  createdAt: number;
  updatedAt: number;
};
