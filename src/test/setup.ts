import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { useUIStore } from '@stores/useUIStore';

beforeEach(() => {
  window.localStorage.clear();
  useUIStore.setState({
    isSidebarCollapsed: false,
    layoutMode: 'split',
    threadPanelWidth: 58
  });
});
