type MailStatusBarProps = {
  actionStatusLabel: string | null;
  activeFolderName: string;
  layoutMode: 'split' | 'list';
  syncStatusLabel: string;
  totalUnreadCount: number;
};

export const MailStatusBar = ({
  actionStatusLabel,
  activeFolderName,
  layoutMode,
  syncStatusLabel,
  totalUnreadCount
}: MailStatusBarProps) => (
  <footer className="status-bar" aria-label="Mailbox status">
    <span>{totalUnreadCount} unread</span>
    <span>{activeFolderName}</span>
    <span>{layoutMode === 'split' ? 'Split layout' : 'List layout'}</span>
    <span>{syncStatusLabel}</span>
    {actionStatusLabel ? <span>{actionStatusLabel}</span> : null}
  </footer>
);
