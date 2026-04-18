import { useQuery } from '@tanstack/react-query';
import type { ThreadRecord } from '@lib/contracts';
import { toThreadSummary } from '@lib/thread-summary';
import { api, tauriRuntime } from '@lib/tauri-bridge';

export const useFolderThreads = (
  accountId: string | null,
  folderId: string | null,
  fallbackThreads: ThreadRecord[]
) =>
  useQuery({
    queryKey: ['folder-threads', accountId, folderId],
    enabled: accountId !== null && folderId !== null,
    queryFn: async () => {
      if (!accountId || !folderId) {
        return [];
      }

      if (!tauriRuntime.isAvailable()) {
        return toThreadSummary(
          fallbackThreads.filter((thread) => thread.folder_ids.includes(folderId))
        );
      }

      return api.mailbox.listThreads(accountId, folderId);
    }
  });
