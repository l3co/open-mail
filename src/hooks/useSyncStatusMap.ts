import { useQuery } from '@tanstack/react-query';
import type { SyncStatusDetail } from '@lib/contracts';
import { api, tauriRuntime } from '@lib/tauri-bridge';

const createFallbackStatus = (index: number): SyncStatusDetail => ({
  state: { kind: index === 0 ? 'running' : 'sleeping' },
  phase: index === 0 ? 'syncing-folders' : 'idling',
  folders: [
    {
      path: 'INBOX',
      displayName: index === 0 ? 'Primary Inbox' : 'Secondary Inbox',
      unreadCount: index === 0 ? 2 : 1,
      totalCount: index === 0 ? 12 : 4,
      envelopesDiscovered: index === 0 ? 1 : 0,
      messagesApplied: index === 0 ? 1 : 0
    }
  ],
  foldersSynced: index === 0 ? 1 : 0,
  messagesObserved: index === 0 ? 3 : 1,
  messagesFlagged: 0,
  messagesDeleted: 0,
  lastSyncStartedAt: '2026-03-13T10:00:00Z',
  lastSyncFinishedAt: index === 0 ? null : '2026-03-13T10:02:00Z',
  lastError: null
});

export const useSyncStatusMap = (accountIds: string[]) =>
  useQuery({
    queryKey: ['sync-status-detail', accountIds.sort().join('|')],
    enabled: accountIds.length > 0,
    refetchInterval: tauriRuntime.isAvailable() && accountIds.length ? 1000 : false,
    queryFn: async () => {
      if (!accountIds.length) {
        return {} as Record<string, SyncStatusDetail>;
      }

      if (!tauriRuntime.isAvailable()) {
        return Object.fromEntries(accountIds.map((accountId, index) => [accountId, createFallbackStatus(index)]));
      }

      const statuses = await api.sync.statusDetail();
      return Object.fromEntries(
        accountIds.map((accountId) => [accountId, statuses[accountId] ?? null]).filter((entry) => entry[1] !== null)
      ) as Record<string, SyncStatusDetail>;
    }
  });
