import type { ThreadRecord, ThreadSummary } from '@lib/contracts';

export const toThreadSummary = (threads: ThreadRecord[]): ThreadSummary[] =>
  threads.map((thread) => ({
    id: thread.id,
    subject: thread.subject,
    snippet: thread.snippet,
    participants: thread.participant_ids,
    isUnread: thread.is_unread,
    isStarred: thread.is_starred,
    hasAttachments: thread.has_attachments,
    messageCount: thread.message_count,
    lastMessageAt: thread.last_message_at
  }));

export const getThreadPageFromRecords = (
  threads: ThreadRecord[],
  folderId: string,
  offset: number,
  limit: number
) => toThreadSummary(threads.filter((thread) => thread.folder_ids.includes(folderId)).slice(offset, offset + limit));
