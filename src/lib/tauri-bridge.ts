import { invoke } from '@tauri-apps/api/core';
import type { MailboxOverview, MessageRecord, ThreadRecord } from '@lib/contracts';

const isTauriRuntimeAvailable = () =>
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

const invokeOrThrow = async <T>(command: string, args?: Record<string, unknown>) => {
  if (!isTauriRuntimeAvailable()) {
    throw new Error('Tauri runtime unavailable');
  }

  return invoke<T>(command, args);
};

export const api = {
  mailbox: {
    overview: () => invokeOrThrow<MailboxOverview>('mailbox_overview'),
    listThreads: (accountId: string, folderId: string, offset = 0, limit = 25) =>
      invokeOrThrow<ThreadRecord[]>('list_threads', { accountId, folderId, offset, limit })
  },
  messages: {
    listByThread: (threadId: string) =>
      invokeOrThrow<MessageRecord[]>('list_messages', { threadId }),
    get: (messageId: string) =>
      invokeOrThrow<MessageRecord | null>('get_message', { messageId })
  }
};

export const tauriRuntime = {
  isAvailable: isTauriRuntimeAvailable
};
