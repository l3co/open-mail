import { type FormEvent, useState } from 'react';
import {
  BellDot,
  Command,
  PencilLine,
  Search,
  Sparkles,
  Archive,
  Inbox,
  Send,
  Star,
  Trash2,
  Paperclip,
  Reply
} from 'lucide-react';
import { StatusBadge } from '@components/ui/StatusBadge';
import type { FolderRecord, MessageRecord, SyncStatusDetail, ThreadSummary } from '@lib/contracts';

type ShellFrameProps = {
  backendStatus: string;
  folders: FolderRecord[];
  threads: ThreadSummary[];
  activeFolderId: string | null;
  searchQuery: string;
  isSearchActive: boolean;
  selectedThreadId: string | null;
  selectedThread: ThreadSummary | null;
  messages: MessageRecord[];
  selectedMessageId: string | null;
  selectedMessage: MessageRecord | null;
  syncStatusDetail: SyncStatusDetail | null;
  outboxStatus: string;
  isOutboxBusy: boolean;
  isMessagesLoading: boolean;
  onSelectFolder: (folderId: string) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectThread: (threadId: string) => void;
  onSelectMessage: (messageId: string) => void;
  onSendDraft: (draft: { to: string; subject: string; body: string }) => Promise<void>;
  onFlushOutbox: () => Promise<void>;
};

const folderIconMap = {
  inbox: Inbox,
  starred: Star,
  sent: Send,
  archive: Archive,
  trash: Trash2
} as const;

const formatThreadTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Agora';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatMessageDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Agora';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getPrimaryAuthor = (message: MessageRecord) =>
  message.from[0]?.name ?? message.from[0]?.email ?? 'Open Mail';

export const ShellFrame = ({
  backendStatus,
  folders,
  threads,
  activeFolderId,
  searchQuery,
  isSearchActive,
  selectedThreadId,
  selectedThread,
  messages,
  selectedMessageId,
  selectedMessage,
  syncStatusDetail,
  outboxStatus,
  isOutboxBusy,
  isMessagesLoading,
  onSelectFolder,
  onSearchQueryChange,
  onSelectThread,
  onSelectMessage,
  onSendDraft,
  onFlushOutbox
}: ShellFrameProps) => {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draftTo, setDraftTo] = useState('team@example.com');
  const [draftSubject, setDraftSubject] = useState('Desktop alpha update');
  const [draftBody, setDraftBody] = useState('Open Mail phase 2 is ready for the next review.');
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? null;
  const selectedMessageParticipants = selectedMessage?.to.map((contact) => contact.email).join(', ') ?? '';
  const threadPanelTitle = isSearchActive ? `Search results for "${searchQuery.trim()}"` : activeFolder?.name ?? 'Message stream';
  const threadPanelCountLabel = isSearchActive ? `${threads.length} matches` : `${threads.length} threads`;
  const syncPhaseLabel = syncStatusDetail?.phase ? syncStatusDetail.phase.replaceAll('-', ' ') : 'sync idle';
  const syncFoldersLabel = syncStatusDetail ? `${syncStatusDetail.foldersSynced} folders` : '0 folders';
  const syncMessagesLabel = syncStatusDetail
    ? `${syncStatusDetail.messagesObserved} observed, ${syncStatusDetail.messagesDeleted} removed`
    : '0 observed';
  const submitDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSendDraft({
      to: draftTo,
      subject: draftSubject,
      body: draftBody
    });
    setIsComposerOpen(false);
  };

  return (
    <div className="shell-root">
      <div className="shell-backdrop" aria-hidden="true" />
      <aside className="sidebar-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="eyebrow">Tauri v2 + React</p>
            <h1>Open Mail</h1>
          </div>
        </div>

        <button
          className="compose-button"
          onClick={() => setIsComposerOpen((current) => !current)}
          type="button"
        >
          <PencilLine size={16} />
          {isComposerOpen ? 'Close composer' : 'New message'}
        </button>

        {isComposerOpen ? (
          <form className="composer-card" onSubmit={submitDraft}>
            <label>
              <span>To</span>
              <input
                onChange={(event) => setDraftTo(event.target.value)}
                placeholder="team@example.com"
                required
                type="email"
                value={draftTo}
              />
            </label>
            <label>
              <span>Subject</span>
              <input
                onChange={(event) => setDraftSubject(event.target.value)}
                placeholder="What is this about?"
                required
                value={draftSubject}
              />
            </label>
            <label>
              <span>Message</span>
              <textarea
                onChange={(event) => setDraftBody(event.target.value)}
                placeholder="Write the update..."
                required
                rows={5}
                value={draftBody}
              />
            </label>
            <div className="composer-actions">
              <button className="composer-secondary" disabled={isOutboxBusy} onClick={onFlushOutbox} type="button">
                Flush outbox
              </button>
              <button className="composer-primary" disabled={isOutboxBusy} type="submit">
                {isOutboxBusy ? 'Working...' : 'Queue'}
              </button>
            </div>
            <p className="composer-status" role="status">
              {outboxStatus}
            </p>
          </form>
        ) : (
          <div className="outbox-mini-card">
            <span>Outbox</span>
            <strong>{outboxStatus}</strong>
            <button disabled={isOutboxBusy} onClick={onFlushOutbox} type="button">
              {isOutboxBusy ? 'Sending...' : 'Flush queue'}
            </button>
          </div>
        )}

        <nav className="folder-nav" aria-label="Mailbox folders">
          {folders.map((folder) => {
            const Icon = folder.role ? folderIconMap[folder.role as keyof typeof folderIconMap] ?? BellDot : BellDot;
            return (
              <button
                className={folder.id === activeFolderId ? 'folder-link folder-link-active' : 'folder-link'}
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                type="button"
              >
                <span className="folder-link-main">
                  <Icon size={16} />
                  {folder.name}
                </span>
                <span className="folder-count">{folder.unread_count}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <StatusBadge label="Foundation" tone="accent" />
          <p>Arquitetura inicial pronta para evoluir as próximas fases do roadmap.</p>
        </div>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <label className="search-shell" aria-label="Search">
            <Search size={16} />
            <input
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search threads, people, commands"
              value={searchQuery}
            />
            <span className="shortcut-pill">
              <Command size={12} />
              K
            </span>
          </label>

          <div className="status-row">
            <StatusBadge label={backendStatus} tone="success" />
          </div>
        </header>

        <section className="hero-card">
          <div>
            <p className="eyebrow">Luxury minimal shell</p>
            <h2>Hello Open Mail</h2>
            <p className="hero-copy">
              O projeto já nasce com Tauri v2, React 19, TypeScript estrito, IPC funcional e um shell
              visual pronto para receber sync engine, banco e composer.
            </p>
          </div>

          <div className="hero-metrics" aria-label="Project health">
            <article>
              <span>Sync phase</span>
              <strong>{syncPhaseLabel}</strong>
            </article>
            <article>
              <span>Folders</span>
              <strong>{syncFoldersLabel}</strong>
            </article>
            <article>
              <span>Messages</span>
              <strong>{syncMessagesLabel}</strong>
            </article>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="thread-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Prototype inbox</p>
                <h3>{threadPanelTitle}</h3>
              </div>
              <StatusBadge label={threadPanelCountLabel} tone="neutral" />
            </div>

            {!threads.length ? (
              <div className="thread-empty-state">
                <p className="thread-empty-title">
                  {isSearchActive ? 'No results found' : `${activeFolder?.name ?? 'Folder'} is clear`}
                </p>
                <p className="thread-empty-copy">
                  {isSearchActive
                    ? 'Tente outro termo para localizar conversas por assunto, snippet ou participante.'
                    : 'Nenhuma thread encontrada nesta pasta no momento. Quando houver atividade, ela aparece aqui.'}
                </p>
              </div>
            ) : null}

            <div className="thread-list">
              {threads.map((thread) => (
                <button
                  className={thread.id === selectedThreadId ? 'thread-card thread-card-active' : 'thread-card'}
                  key={thread.id}
                  onClick={() => onSelectThread(thread.id)}
                  type="button"
                >
                  <div className="thread-card-row">
                    <h4>{thread.participants[0] ?? 'Open Mail'}</h4>
                    <span>{formatThreadTime(thread.lastMessageAt)}</span>
                  </div>
                  <p className="thread-subject">{thread.subject}</p>
                  <p className="thread-preview">{thread.snippet}</p>
                  {thread.isUnread ? <span className="thread-dot" aria-label="Unread thread" /> : null}
                </button>
              ))}
            </div>
          </div>

          <aside className="insight-panel reader-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Thread reader</p>
                <h3>{selectedThread?.subject ?? 'Select a conversation'}</h3>
              </div>
              {selectedThread ? <StatusBadge label={`${messages.length} messages`} tone="neutral" /> : null}
            </div>

            {isMessagesLoading ? (
              <p className="reader-empty">Carregando a thread selecionada...</p>
            ) : null}

            {!isMessagesLoading && !selectedThread ? (
              <p className="reader-empty">Selecione uma thread para ver o histórico completo da conversa.</p>
            ) : null}

            {!isMessagesLoading && selectedThread ? (
              <div className="message-stack">
                {messages.map((message) => (
                  <button
                    className={
                      message.id === selectedMessageId ? 'message-card message-card-active' : 'message-card'
                    }
                    key={message.id}
                    onClick={() => onSelectMessage(message.id)}
                    type="button"
                  >
                    <div className="message-meta">
                      <div>
                        <p className="message-author">{getPrimaryAuthor(message)}</p>
                        <p className="message-address">{message.from[0]?.email ?? 'unknown@openmail.dev'}</p>
                      </div>

                      <div className="message-actions">
                        <span>{formatMessageDate(message.date)}</span>
                        <span aria-label="Reply to message" className="message-action" role="presentation">
                          <Reply size={14} />
                        </span>
                      </div>
                    </div>

                    <p className="message-snippet">{message.plain_text ?? message.snippet}</p>

                    {message.attachments.length ? (
                      <div className="attachment-strip">
                        {message.attachments.map((attachment) => (
                          <span className="attachment-chip" key={attachment.id}>
                            <Paperclip size={12} />
                            {attachment.filename}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                ))}

                {selectedMessage ? (
                  <section className="message-detail-card">
                    <div className="message-detail-row">
                      <span className="message-detail-label">Subject</span>
                      <strong>{selectedMessage.subject}</strong>
                    </div>

                    <div className="message-detail-row">
                      <span className="message-detail-label">From</span>
                      <span>{selectedMessage.from[0]?.email ?? 'unknown@openmail.dev'}</span>
                    </div>

                    {selectedMessageParticipants ? (
                      <div className="message-detail-row">
                        <span className="message-detail-label">To</span>
                        <span>{selectedMessageParticipants}</span>
                      </div>
                    ) : null}

                    <div className="message-detail-row">
                      <span className="message-detail-label">Message-ID</span>
                      <span>{selectedMessage.message_id_header}</span>
                    </div>

                    {Object.keys(selectedMessage.headers).length ? (
                      <div className="message-header-grid">
                        {Object.entries(selectedMessage.headers).map(([key, value]) => (
                          <div className="message-header-chip" key={key}>
                            <span>{key}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
};
