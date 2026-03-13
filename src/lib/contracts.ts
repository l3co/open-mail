export type SyncState =
  | { kind: 'not-started' }
  | { kind: 'running' }
  | { kind: 'sleeping' }
  | { kind: 'error'; message: string };

export type DomainEvent =
  | { type: 'threads-changed'; accountId: string; threadIds: string[] }
  | { type: 'messages-changed'; accountId: string; messageIds: string[] }
  | { type: 'folders-changed'; accountId: string }
  | { type: 'labels-changed'; accountId: string }
  | { type: 'contacts-changed'; accountId: string }
  | { type: 'sync-status-changed'; accountId: string; state: SyncState }
  | { type: 'account-added'; accountId: string }
  | { type: 'account-removed'; accountId: string };

export type ThreadSummary = {
  id: string;
  subject: string;
  snippet: string;
  participants: string[];
  isUnread: boolean;
  isStarred: boolean;
  lastMessageAt: string;
};

export type MailboxReadModel = {
  activeFolder: string;
  syncState: SyncState;
  threads: ThreadSummary[];
};

