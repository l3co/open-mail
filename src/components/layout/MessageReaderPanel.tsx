import { MessageList } from '@components/message-list/MessageList';
import { StatusBadge } from '@components/ui/StatusBadge';
import type { MessageRecord, ThreadSummary } from '@lib/contracts';

type MessageReaderPanelProps = {
  isMessagesLoading: boolean;
  messages: MessageRecord[];
  selectedMessageId: string | null;
  selectedThread: ThreadSummary | null;
  onSelectMessage: (messageId: string) => void;
};

export const MessageReaderPanel = ({
  isMessagesLoading,
  messages,
  selectedMessageId,
  selectedThread,
  onSelectMessage
}: MessageReaderPanelProps) => {
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
        <MessageList
          messages={messages}
          selectedMessageId={selectedMessageId}
          threadSubject={selectedThread.subject}
          onSelectMessage={onSelectMessage}
        />
      ) : null}
    </aside>
  );
};
