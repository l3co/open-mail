import { describe, expect, it } from 'vitest';
import type {
  DomainEvent,
  EnqueueOutboxMessageRequest,
  MailboxReadModel,
  OutboxMessage,
  SyncStatusDetail
} from '@lib/contracts';

describe('contracts', () => {
  it('supports mailbox read models for future IPC hydration', () => {
    const mailbox: MailboxReadModel = {
      accountId: 'acc_1',
      activeFolder: 'fld_inbox',
      syncState: { kind: 'running' },
      folders: [],
      allThreads: [],
      threads: [
        {
          id: 'thr_1',
          subject: 'Subject',
          snippet: 'Preview',
          participants: ['hello@example.com'],
          isUnread: true,
          isStarred: false,
          hasAttachments: false,
          messageCount: 1,
          lastMessageAt: '2026-03-13T10:00:00Z'
        }
      ]
    };

    expect(mailbox.threads).toHaveLength(1);
    expect(mailbox.allThreads).toHaveLength(0);
  });

  it('covers domain events consumed by the frontend shell', () => {
    const event: DomainEvent = {
      type: 'sync-status-changed',
      accountId: 'acc_1',
      state: { kind: 'sleeping' }
    };

    expect(event.type).toBe('sync-status-changed');
  });

  it('supports detailed sync snapshots for the phase 2 shell', () => {
    const status: SyncStatusDetail = {
      state: { kind: 'sleeping' },
      phase: 'idling',
      folders: [
        {
          path: 'INBOX',
          displayName: 'Inbox',
          unreadCount: 2,
          totalCount: 12,
          envelopesDiscovered: 1,
          messagesApplied: 1
        }
      ],
      foldersSynced: 1,
      messagesObserved: 3,
      messagesFlagged: 1,
      messagesDeleted: 1,
      lastSyncStartedAt: '2026-03-13T10:00:00Z',
      lastSyncFinishedAt: '2026-03-13T10:00:25Z',
      lastError: null
    };

    expect(status.phase).toBe('idling');
    expect(status.folders[0]?.displayName).toBe('Inbox');
    expect(status.folders[0]?.messagesApplied).toBe(1);
    expect(status.messagesDeleted).toBe(1);
  });

  it('supports outbox enqueue contracts for smtp phase 2', () => {
    const request: EnqueueOutboxMessageRequest = {
      accountId: 'acc_demo',
      from: { name: null, email: 'leco@example.com' },
      to: [{ name: 'Team', email: 'team@example.com' }],
      cc: [],
      bcc: [],
      replyTo: null,
      subject: 'Desktop alpha',
      htmlBody: '<p>Ready</p>',
      plainBody: 'Ready',
      inReplyTo: null,
      references: [],
      attachments: []
    };
    const queued: OutboxMessage = {
      id: 'out_1',
      accountId: request.accountId,
      mimeMessage: request,
      status: 'queued',
      retryCount: 0,
      lastError: null,
      queuedAt: '2026-03-13T10:00:00Z',
      updatedAt: '2026-03-13T10:00:00Z'
    };

    expect(queued.mimeMessage.to[0]?.email).toBe('team@example.com');
    expect(queued.status).toBe('queued');
  });
});
