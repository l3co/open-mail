import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { defaultShortcutBindings, useShortcutStore } from '@stores/useShortcutStore';
import { useSignatureStore } from '@stores/useSignatureStore';
import { useThreadStore } from '@stores/useThreadStore';
import { useUndoStore } from '@stores/useUndoStore';
import { useUIStore } from '@stores/useUIStore';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    })
  });
}

beforeEach(() => {
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
  useUIStore.setState({
    isSidebarCollapsed: false,
    layoutMode: 'split',
    themeId: 'system',
    threadPanelWidth: 58
  });
  useShortcutStore.setState({
    bindings: defaultShortcutBindings
  });
  useSignatureStore.setState({
    signatures: [
      {
        id: 'sig_default',
        title: 'Default signature',
        body: '<p>Best,<br />Leco</p>',
        accountId: null
      }
    ],
    defaultSignatureId: 'sig_default'
  });
  useThreadStore.setState({
    activeFolderKey: null,
    hasMore: false,
    hasMoreByFolderKey: {},
    isLoading: false,
    offset: 0,
    offsetByFolderKey: {},
    threadRecords: [],
    threads: [],
    threadsByFolderKey: {},
    threadSummaries: [],
    selectedThreadId: null
  });
  useUndoStore.setState({ actions: [], currentToast: null });
});
