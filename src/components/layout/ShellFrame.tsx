import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { MailSidebar } from '@components/layout/MailSidebar';
import { MailStatusBar } from '@components/layout/MailStatusBar';
import { MailTopbar } from '@components/layout/MailTopbar';
import { MessageReaderPanel } from '@components/layout/MessageReaderPanel';
import { ThreadListPanel } from '@components/layout/ThreadListPanel';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import type { FolderRecord, MessageRecord, SyncStatusDetail, ThreadSummary } from '@lib/contracts';
import { useUIStore } from '@stores/useUIStore';

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isResizingThreadPanel, setIsResizingThreadPanel] = useState(false);
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const layoutMode = useUIStore((state) => state.layoutMode);
  const themeId = useUIStore((state) => state.themeId);
  const threadPanelWidth = useUIStore((state) => state.threadPanelWidth);
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleLayoutMode = useUIStore((state) => state.toggleLayoutMode);
  const cycleTheme = useUIStore((state) => state.cycleTheme);
  const setThreadPanelWidth = useUIStore((state) => state.setThreadPanelWidth);
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? null;
  const syncPhaseLabel = syncStatusDetail?.phase ? syncStatusDetail.phase.replaceAll('-', ' ') : 'sync idle';
  const syncFoldersLabel = syncStatusDetail ? `${syncStatusDetail.foldersSynced} folders` : '0 folders';
  const syncMessagesLabel = syncStatusDetail
    ? `${syncStatusDetail.messagesObserved} observed, ${syncStatusDetail.messagesDeleted} removed`
    : '0 observed';
  const totalUnreadCount = folders.reduce((total, folder) => total + folder.unread_count, 0);
  const syncStatusLabel = syncStatusDetail?.phase
    ? `Sync ${syncStatusDetail.phase.replaceAll('-', ' ')}`
    : backendStatus;
  const selectedThreadIndex = threads.findIndex((thread) => thread.id === selectedThreadId);
  const selectThreadByOffset = (offset: number) => {
    if (!threads.length) {
      return;
    }

    const currentIndex = selectedThreadIndex >= 0 ? selectedThreadIndex : 0;
    const nextIndex = Math.min(threads.length - 1, Math.max(0, currentIndex + offset));
    onSelectThread(threads[nextIndex].id);
  };
  const selectSystemFolder = (role: string) => {
    const folder = folders.find((candidate) => candidate.role === role);
    if (folder) {
      onSelectFolder(folder.id);
    }
  };
  const workspaceStyle = {
    '--thread-panel-width': `${threadPanelWidth}%`
  } as CSSProperties;
  const toggleComposer = () => setIsComposerOpen((current) => !current);
  const toggleSidebarAndCloseComposer = () => {
    toggleSidebar();
    setIsComposerOpen(false);
  };

  useKeyboardShortcuts({
    'mod+k': () => searchInputRef.current?.focus(),
    'mod+n': () => {
      setSidebarCollapsed(false);
      setIsComposerOpen(true);
    },
    'mod+shift+n': () => {
      setSidebarCollapsed(false);
      setIsComposerOpen(true);
    },
    'mod+1': () => selectSystemFolder('inbox'),
    'mod+2': () => selectSystemFolder('sent'),
    'mod+3': () => selectSystemFolder('drafts'),
    j: () => selectThreadByOffset(1),
    k: () => selectThreadByOffset(-1),
    escape: () => {
      setIsComposerOpen(false);
      searchInputRef.current?.blur();
    }
  });

  useEffect(() => {
    if (!isResizingThreadPanel) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = workspaceRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
      setThreadPanelWidth(nextWidth);
    };
    const stopResize = () => setIsResizingThreadPanel(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
    };
  }, [isResizingThreadPanel, setThreadPanelWidth]);

  return (
    <div className={isSidebarCollapsed ? 'shell-root shell-root-sidebar-collapsed' : 'shell-root'}>
      <div className="shell-backdrop" aria-hidden="true" />
      <MailSidebar
        activeFolderId={activeFolderId}
        folders={folders}
        isCollapsed={isSidebarCollapsed}
        isComposerOpen={isComposerOpen}
        isOutboxBusy={isOutboxBusy}
        outboxStatus={outboxStatus}
        onFlushOutbox={onFlushOutbox}
        onSelectFolder={onSelectFolder}
        onSendDraft={onSendDraft}
        onToggleComposer={toggleComposer}
        onToggleSidebar={toggleSidebarAndCloseComposer}
      />

      <main className="content-panel">
        <MailTopbar
          backendStatus={backendStatus}
          layoutMode={layoutMode}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          themeId={themeId}
          onCycleTheme={cycleTheme}
          onSearchQueryChange={onSearchQueryChange}
          onToggleLayoutMode={toggleLayoutMode}
        />

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

        <section
          className={[
            'workspace-grid',
            layoutMode === 'list' ? 'workspace-grid-list' : '',
            isResizingThreadPanel ? 'workspace-grid-resizing' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          ref={workspaceRef}
          style={workspaceStyle}
        >
          <ThreadListPanel
            activeFolderName={activeFolder?.name ?? null}
            isSearchActive={isSearchActive}
            searchQuery={searchQuery}
            selectedThreadId={selectedThreadId}
            threads={threads}
            onSelectThread={onSelectThread}
          />

          <button
            aria-label="Resize thread and reader panels"
            aria-orientation="vertical"
            className="panel-resizer"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setIsResizingThreadPanel(true);
            }}
            role="separator"
            type="button"
          >
            <GripVertical size={16} />
          </button>

          <MessageReaderPanel
            isMessagesLoading={isMessagesLoading}
            messages={messages}
            selectedMessage={selectedMessage}
            selectedMessageId={selectedMessageId}
            selectedThread={selectedThread}
            onSelectMessage={onSelectMessage}
          />
        </section>

        <MailStatusBar
          activeFolderName={activeFolder?.name ?? 'No folder selected'}
          layoutMode={layoutMode}
          syncStatusLabel={syncStatusLabel}
          totalUnreadCount={totalUnreadCount}
        />
      </main>
    </div>
  );
};
