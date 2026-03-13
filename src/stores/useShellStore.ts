import { create } from 'zustand';
import type { MailboxReadModel, SyncState, ThreadSummary } from '@lib/contracts';

type ShellState = {
  activeFolder: string;
  syncState: SyncState;
  threads: ThreadSummary[];
  setActiveFolder: (folder: string) => void;
  hydrateMailbox: (mailbox: MailboxReadModel) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  activeFolder: 'Inbox',
  syncState: { kind: 'not-started' },
  threads: [],
  setActiveFolder: (activeFolder) => set({ activeFolder }),
  hydrateMailbox: (mailbox) =>
    set({
      activeFolder: mailbox.activeFolder,
      syncState: mailbox.syncState,
      threads: mailbox.threads
    })
}));

