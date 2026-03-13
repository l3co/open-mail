import { useEffect, useState } from 'react';
import { ShellFrame } from '@components/layout/ShellFrame';
import { useFolderThreads } from '@hooks/useFolderThreads';
import { useBackendHealth } from '@hooks/useBackendHealth';
import { useMessageDetail } from '@hooks/useMessageDetail';
import { useMailboxOverview } from '@hooks/useMailboxOverview';
import { useThreadMessages } from '@hooks/useThreadMessages';

const App = () => {
  const { data, isLoading, isError } = useBackendHealth();
  const mailboxQuery = useMailboxOverview();
  const mailbox = mailboxQuery.data;
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const folderThreadsQuery = useFolderThreads(
    mailbox?.accountId ?? null,
    selectedFolderId,
    mailbox?.allThreads ?? []
  );
  const threads = folderThreadsQuery.data ?? mailbox?.threads ?? [];
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;
  const messagesQuery = useThreadMessages(selectedThread?.id ?? null);
  const messageDetailQuery = useMessageDetail(selectedMessageId);

  useEffect(() => {
    if (!mailbox?.folders.length) {
      setSelectedFolderId(null);
      return;
    }

    setSelectedFolderId((currentFolderId) =>
      currentFolderId && mailbox.folders.some((folder) => folder.id === currentFolderId)
        ? currentFolderId
        : mailbox.activeFolder
    );
  }, [mailbox]);

  useEffect(() => {
    if (!threads.length) {
      setSelectedThreadId(null);
      setSelectedMessageId(null);
      return;
    }

    setSelectedThreadId((currentThreadId) =>
      currentThreadId && threads.some((thread) => thread.id === currentThreadId)
        ? currentThreadId
        : threads[0].id
    );
  }, [threads]);

  useEffect(() => {
    const messages = messagesQuery.data ?? [];

    if (!messages.length) {
      setSelectedMessageId(null);
      return;
    }

    setSelectedMessageId((currentMessageId) =>
      currentMessageId && messages.some((message) => message.id === currentMessageId)
        ? currentMessageId
        : messages[0].id
    );
  }, [messagesQuery.data]);

  return (
    <ShellFrame
      backendStatus={
        isLoading ? 'Conectando ao backend Tauri...' : isError ? 'Modo web ativo' : data ?? 'Backend pronto'
      }
      folders={mailbox?.folders ?? []}
      threads={threads}
      activeFolderId={selectedFolderId}
      selectedThreadId={selectedThread?.id ?? null}
      selectedThread={selectedThread}
      messages={messagesQuery.data ?? []}
      selectedMessageId={selectedMessageId}
      selectedMessage={messageDetailQuery.data ?? null}
      isMessagesLoading={
        folderThreadsQuery.isLoading || messagesQuery.isLoading || messageDetailQuery.isLoading
      }
      onSelectFolder={setSelectedFolderId}
      onSelectThread={setSelectedThreadId}
      onSelectMessage={setSelectedMessageId}
    />
  );
};

export default App;
