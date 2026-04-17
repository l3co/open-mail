import { StatusBadge } from '@components/ui/StatusBadge';
import type { ThreadSummary } from '@lib/contracts';

type ThreadListPanelProps = {
  activeFolderName: string | null;
  isSearchActive: boolean;
  searchQuery: string;
  selectedThreadId: string | null;
  threads: ThreadSummary[];
  onSelectThread: (threadId: string) => void;
};

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

export const ThreadListPanel = ({
  activeFolderName,
  isSearchActive,
  searchQuery,
  selectedThreadId,
  threads,
  onSelectThread
}: ThreadListPanelProps) => {
  const title = isSearchActive ? `Search results for "${searchQuery.trim()}"` : activeFolderName ?? 'Message stream';
  const countLabel = isSearchActive ? `${threads.length} matches` : `${threads.length} threads`;

  return (
    <div className="thread-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Prototype inbox</p>
          <h3>{title}</h3>
        </div>
        <StatusBadge label={countLabel} tone="neutral" />
      </div>

      {!threads.length ? (
        <div className="thread-empty-state">
          <p className="thread-empty-title">
            {isSearchActive ? 'No results found' : `${activeFolderName ?? 'Folder'} is clear`}
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
  );
};
