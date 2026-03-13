import { useQuery } from '@tanstack/react-query';
import type { MessageRecord } from '@lib/contracts';
import { api, tauriRuntime } from '@lib/tauri-bridge';

const fallbackMessages: Record<string, MessageRecord[]> = {
  thr_1: [
    {
      id: 'msg_1',
      account_id: 'acc_demo',
      thread_id: 'thr_1',
      from: [
        {
          id: 'ct_atlas',
          account_id: 'acc_demo',
          name: 'Atlas Design',
          email: 'atlas@example.com',
          is_me: false,
          created_at: '2026-03-13T10:00:00Z',
          updated_at: '2026-03-13T10:00:00Z'
        }
      ],
      to: [],
      cc: [],
      bcc: [],
      reply_to: [],
      subject: 'Premium motion system approved',
      snippet: 'Vamos fechar a base visual do composer e da thread list hoje.',
      body: '<p>Vamos fechar a base visual do composer e da thread list hoje.</p>',
      plain_text: 'Vamos fechar a base visual do composer e da thread list hoje.',
      message_id_header: '<msg_1@openmail.dev>',
      in_reply_to: null,
      references: [],
      folder_id: 'fld_inbox',
      label_ids: [],
      is_unread: true,
      is_starred: false,
      is_draft: false,
      date: '2026-03-13T10:00:00Z',
      attachments: [
        {
          id: 'att_1',
          message_id: 'msg_1',
          filename: 'motion-notes.pdf',
          content_type: 'application/pdf',
          size: 2048,
          content_id: null,
          is_inline: false,
          local_path: null
        }
      ],
      headers: {},
      created_at: '2026-03-13T10:00:00Z',
      updated_at: '2026-03-13T10:00:00Z'
    }
  ],
  thr_2: [
    {
      id: 'msg_2',
      account_id: 'acc_demo',
      thread_id: 'thr_2',
      from: [
        {
          id: 'ct_infra',
          account_id: 'acc_demo',
          name: 'Infra Sync',
          email: 'infra@example.com',
          is_me: false,
          created_at: '2026-03-13T10:00:00Z',
          updated_at: '2026-03-13T10:00:00Z'
        }
      ],
      to: [],
      cc: [],
      bcc: [],
      reply_to: [],
      subject: 'Rust health-check online',
      snippet: 'IPC inicial respondeu sem erro e o shell já consegue refletir o estado.',
      body: '<p>IPC inicial respondeu sem erro e o shell já consegue refletir o estado.</p>',
      plain_text: 'IPC inicial respondeu sem erro e o shell já consegue refletir o estado.',
      message_id_header: '<msg_2@openmail.dev>',
      in_reply_to: null,
      references: [],
      folder_id: 'fld_inbox',
      label_ids: [],
      is_unread: false,
      is_starred: true,
      is_draft: false,
      date: '2026-03-13T09:28:00Z',
      attachments: [],
      headers: {},
      created_at: '2026-03-13T10:00:00Z',
      updated_at: '2026-03-13T10:00:00Z'
    }
  ]
};

export const useThreadMessages = (threadId: string | null) =>
  useQuery({
    queryKey: ['thread-messages', threadId],
    enabled: threadId !== null,
    queryFn: async () => {
      if (!threadId) {
        return [];
      }

      if (!tauriRuntime.isAvailable()) {
        return fallbackMessages[threadId] ?? [];
      }

      return api.messages.listByThread(threadId);
    }
  });
