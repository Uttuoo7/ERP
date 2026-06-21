import { create } from 'zustand';

export type DockablePanelType = 'notifications' | 'workflow' | 'calendar' | 'recents' | 'ai-assistant' | 'chat';

interface DockableState {
  activePanel: DockablePanelType | null;
  isPinned: boolean;
  isOpen: boolean;
  width: number;
  openPanel: (panel: DockablePanelType) => void;
  closePanel: () => void;
  togglePin: () => void;
  setWidth: (width: number) => void;
}

export const useDockableStore = create<DockableState>((set) => {
  const getStoredPin = (): boolean => {
    try {
      return localStorage.getItem('erp-dockable-pinned') === 'true';
    } catch {
      return false;
    }
  };

  return {
    activePanel: null,
    isPinned: getStoredPin(),
    isOpen: false,
    width: 360,

    openPanel: (panel) => set({ activePanel: panel, isOpen: true }),
    
    closePanel: () => set({ isOpen: false, activePanel: null }),
    
    togglePin: () => set((state) => {
      const nextPin = !state.isPinned;
      try {
        localStorage.setItem('erp-dockable-pinned', String(nextPin));
      } catch {}
      return { isPinned: nextPin };
    }),

    setWidth: (width) => set({ width: Math.max(280, Math.min(600, width)) })
  };
});
