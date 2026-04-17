import type { RefObject } from 'react';
import { Command, Search } from 'lucide-react';
import { StatusBadge } from '@components/ui/StatusBadge';
import type { ThemeId } from '@lib/themes';

type MailTopbarProps = {
  backendStatus: string;
  layoutMode: 'split' | 'list';
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  themeId: ThemeId;
  onCycleTheme: () => void;
  onSearchQueryChange: (query: string) => void;
  onToggleLayoutMode: () => void;
};

export const MailTopbar = ({
  backendStatus,
  layoutMode,
  searchInputRef,
  searchQuery,
  themeId,
  onCycleTheme,
  onSearchQueryChange,
  onToggleLayoutMode
}: MailTopbarProps) => (
  <header className="topbar">
    <label className="search-shell" aria-label="Search">
      <Search size={16} />
      <input
        ref={searchInputRef}
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
      <button aria-label={`Switch theme (${themeId})`} className="theme-toggle" onClick={onCycleTheme} type="button">
        {themeId}
      </button>
      <button
        aria-label={layoutMode === 'split' ? 'Switch to list layout' : 'Switch to split layout'}
        aria-pressed={layoutMode === 'list'}
        className="layout-toggle"
        onClick={onToggleLayoutMode}
        type="button"
      >
        {layoutMode === 'split' ? 'Split' : 'List'}
      </button>
      <StatusBadge label={backendStatus} tone="success" />
    </div>
  </header>
);
