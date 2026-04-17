import { Paperclip, Reply } from 'lucide-react';
import { StatusBadge } from '@components/ui/StatusBadge';
import type { MessageRecord, ThreadSummary } from '@lib/contracts';

type MessageReaderPanelProps = {
  isMessagesLoading: boolean;
  messages: MessageRecord[];
  selectedMessage: MessageRecord | null;
  selectedMessageId: string | null;
  selectedThread: ThreadSummary | null;
  onSelectMessage: (messageId: string) => void;
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

export const MessageReaderPanel = ({
  isMessagesLoading,
  messages,
  selectedMessage,
  selectedMessageId,
  selectedThread,
  onSelectMessage
}: MessageReaderPanelProps) => {
  const selectedMessageParticipants = selectedMessage?.to.map((contact) => contact.email).join(', ') ?? '';

  return (
    <aside className="insight-panel reader-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Thread reader</p>
          <h3>{selectedThread?.subject ?? 'Select a conversation'}</h3>
        </div>
        {selectedThread ? <StatusBadge label={`${messages.length} messages`} tone="neutral" /> : null}
      </div>

      {isMessagesLoading ? <p className="reader-empty">Carregando a thread selecionada...</p> : null}

      {!isMessagesLoading && !selectedThread ? (
        <p className="reader-empty">Selecione uma thread para ver o histórico completo da conversa.</p>
      ) : null}

      {!isMessagesLoading && selectedThread ? (
        <div className="message-stack">
          {messages.map((message) => (
            <button
              className={message.id === selectedMessageId ? 'message-card message-card-active' : 'message-card'}
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
  );
};
