import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LayoutMode = 'split' | 'list';

type UIState = {
  isSidebarCollapsed: boolean;
  layoutMode: LayoutMode;
  threadPanelWidth: number;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  toggleSidebar: () => void;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleLayoutMode: () => void;
  setThreadPanelWidth: (width: number) => void;
};

const clampThreadPanelWidth = (width: number) => Math.min(72, Math.max(38, width));

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      layoutMode: 'split',
      threadPanelWidth: 58,
      setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      toggleLayoutMode: () =>
        set((state) => ({
          layoutMode: state.layoutMode === 'split' ? 'list' : 'split'
        })),
      setThreadPanelWidth: (threadPanelWidth) =>
        set({ threadPanelWidth: clampThreadPanelWidth(threadPanelWidth) })
    }),
    {
      name: 'open-mail-ui'
    }
  )
);
