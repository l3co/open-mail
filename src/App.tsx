import { useEffect, useState } from 'react';
import { ShellFrame } from '@components/layout/ShellFrame';
import { useBackendHealth } from '@hooks/useBackendHealth';
import { useMailboxOverview } from '@hooks/useMailboxOverview';
import { useThreadMessages } from '@hooks/useThreadMessages';

const App = () => {
  const { data, isLoading, isError } = useBackendHealth();
  const mailboxQuery = useMailboxOverview();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const threads = mailboxQuery.data?.threads ?? [];
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;
  const messagesQuery = useThreadMessages(selectedThread?.id ?? null);

  useEffect(() => {
    if (!threads.length) {
      setSelectedThreadId(null);
      return;
    }

    setSelectedThreadId((currentThreadId) =>
      currentThreadId && threads.some((thread) => thread.id === currentThreadId)
        ? currentThreadId
        : threads[0].id
    );
  }, [threads]);

  return (
    <ShellFrame
      backendStatus={
        isLoading ? 'Conectando ao backend Tauri...' : isError ? 'Modo web ativo' : data ?? 'Backend pronto'
      }
      folders={mailboxQuery.data?.folders ?? []}
      threads={threads}
      selectedThreadId={selectedThread?.id ?? null}
      selectedThread={selectedThread}
      messages={messagesQuery.data ?? []}
      isMessagesLoading={messagesQuery.isLoading}
      onSelectThread={setSelectedThreadId}
    />
  );
};

export default App;
