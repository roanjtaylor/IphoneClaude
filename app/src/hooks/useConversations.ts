// Conversation-list state for the home screen: load, create, rename, delete. Thin
// wrapper over storage/db so the screen stays declarative.
import { useCallback, useEffect, useState } from 'react';
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
} from '../storage/db';
import type { Conversation } from '../storage/types';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await listConversations();
    setConversations(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (): Promise<Conversation> => {
    const conv = await createConversation();
    await refresh();
    return conv;
  }, [refresh]);

  const rename = useCallback(
    async (id: string, title: string) => {
      await renameConversation(id, title);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      await refresh();
    },
    [refresh],
  );

  return { conversations, loading, refresh, create, rename, remove };
}
