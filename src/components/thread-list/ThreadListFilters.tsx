import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ThreadFilter } from '@components/thread-list/threadListUtils';

type ThreadListFiltersProps = {
  activeFilter: ThreadFilter;
  onFilterChange: (filter: ThreadFilter) => void;
};

const filters: Array<{ id: ThreadFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'starred', label: 'Starred' },
  { id: 'attachments', label: 'Attachments' }
];

export const ThreadListFilters = ({ activeFilter, onFilterChange }: ThreadListFiltersProps) => {
  const filterRefs = useRef<Record<ThreadFilter, HTMLButtonElement | null>>({
    all: null,
    unread: null,
    starred: null,
    attachments: null
  });

  const registerFilterRef = (filterId: ThreadFilter) => (element: HTMLButtonElement | null) => {
    filterRefs.current[filterId] = element;
  };

  const moveFocus = (filterId: ThreadFilter, offset: number) => {
    const currentIndex = filters.findIndex((filter) => filter.id === filterId);
    const nextIndex = (currentIndex + offset + filters.length) % filters.length;
    const nextFilter = filters[nextIndex];
    onFilterChange(nextFilter.id);
    filterRefs.current[nextFilter.id]?.focus();
  };

  const focusBoundary = (target: 'first' | 'last') => {
    const nextFilter = target === 'first' ? filters[0] : filters[filters.length - 1];
    onFilterChange(nextFilter.id);
    filterRefs.current[nextFilter.id]?.focus();
  };

  const handleKeyDown = (filterId: ThreadFilter) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(filterId, 1);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(filterId, -1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusBoundary('first');
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusBoundary('last');
    }
  };

  return (
    <div aria-label="Thread filters" className="thread-filters" role="radiogroup">
      {filters.map((filter) => (
        <button
          aria-checked={filter.id === activeFilter}
          className={filter.id === activeFilter ? 'thread-filter thread-filter-active' : 'thread-filter'}
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          onKeyDown={handleKeyDown(filter.id)}
          ref={registerFilterRef(filter.id)}
          role="radio"
          tabIndex={filter.id === activeFilter ? 0 : -1}
          type="button"
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};
