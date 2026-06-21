import { create } from 'zustand';

export interface Tab {
  id: string;
  path: string;
  title: string;
  pinned: boolean;
  splitPath?: string;
  splitOrientation?: 'vertical' | 'horizontal';
  splitRatio?: number;
  serializedState?: Record<string, any>;
  lastActiveTime?: number; // timestamp
}

export function getPageCachePolicy(path: string): 'cache' | 'suspend' {
  const cleanPath = path.split('?')[0].split('#')[0];
  // Suspend immediately if it's an analytics or reports page or similar
  if (
    cleanPath === '/analytics' ||
    cleanPath.includes('/reports') ||
    cleanPath.includes('/observability/') ||
    cleanPath.includes('/snapshots') ||
    cleanPath.includes('/valuation') ||
    cleanPath.includes('/closing-certificate')
  ) {
    return 'suspend';
  }
  return 'cache';
}

interface WorkspaceTabsState {
  tabs: Tab[];
  activeTabId: string | null;
  cachedTabIds: string[]; // LRU order: least recently used first, most recently used at the end
  maxCacheSize: number;
  suspendTimeout: number; // in seconds
  openTab: (path: string, title: string) => void;
  closeTab: (id: string) => void;
  pinTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (nextTabs: Tab[]) => void;
  splitTab: (id: string, splitPath: string | undefined, orientation?: 'vertical' | 'horizontal') => void;
  setTabState: (id: string, key: string, value: any) => void;
  getTabState: (id: string, key: string, defaultValue: any) => any;
  setCacheLimit: (limit: number) => void;
  setSuspendTimeout: (timeout: number) => void;
  checkInactivitySuspension: () => void;
  restoreSession: () => void;
}

const STORAGE_KEY = 'erp-workspace-tabs-session';

export const useWorkspaceTabsStore = create<WorkspaceTabsState>((set, get) => {
  // Sync helper
  const saveToStorage = (tabs: Tab[], activeTabId: string | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tabs: tabs.map(t => ({ ...t, serializedState: t.serializedState })), // keep serialized state
        activeTabId
      }));
    } catch (e) {
      console.error('Failed to persist tabs session:', e);
    }
  };

  return {
    tabs: [],
    activeTabId: null,
    cachedTabIds: [],
    maxCacheSize: 10,
    suspendTimeout: 300, // default 5 minutes

    openTab: (path, title) => {
      const { tabs, activeTabId, cachedTabIds, maxCacheSize } = get();
      
      // Clean path to prevent trailing slashes issues
      const cleanPath = path === '/' ? '/dashboard' : path;

      // Check if tab already exists
      const existingTab = tabs.find(t => t.path === cleanPath);
      
      let nextTabs = [...tabs];
      let nextActiveId = '';

      if (existingTab) {
        nextActiveId = existingTab.id;
      } else {
        const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newTab: Tab = {
          id,
          path: cleanPath,
          title,
          pinned: false,
          serializedState: {},
          lastActiveTime: Date.now()
        };
        nextTabs.push(newTab);
        nextActiveId = id;
      }

      // Handle cache policy for the previously active tab
      let nextCache = [...cachedTabIds];
      if (activeTabId && activeTabId !== nextActiveId) {
        const prevTab = tabs.find(t => t.id === activeTabId);
        if (prevTab && !prevTab.pinned) {
          const policy = getPageCachePolicy(prevTab.path);
          if (policy === 'suspend') {
            nextCache = nextCache.filter(cid => cid !== activeTabId);
            console.log(`[Workspace Lifecycle] Suspending tab immediately (Policy: Suspend): ${prevTab.title}`);
          }
        }
      }

      // Update LRU cache order
      nextCache = nextCache.filter(cid => cid !== nextActiveId);
      nextCache.push(nextActiveId); // Add as most recently used

      // Evict least recently used if exceeding cache size
      if (nextCache.length > maxCacheSize) {
        let evictedIndex = 0;
        let foundEvictionCandidate = false;

        while (evictedIndex < nextCache.length - 1) {
          const candidateId = nextCache[evictedIndex];
          const candidateTab = nextTabs.find(t => t.id === candidateId);
          
          if (candidateTab && !candidateTab.pinned && candidateId !== nextActiveId) {
            nextCache = nextCache.filter(cid => cid !== candidateId);
            foundEvictionCandidate = true;
            console.log(`[Workspace Lifecycle] Cache limit exceeded. Evicting/suspending: ${candidateTab.title}`);
            break;
          }
          evictedIndex++;
        }
        
        // Fallback: if all cached tabs are pinned or active, just evict the first non-active one
        if (!foundEvictionCandidate && nextCache.length > maxCacheSize) {
          const candidateId = nextCache.find(cid => cid !== nextActiveId);
          if (candidateId) {
            nextCache = nextCache.filter(cid => cid !== candidateId);
          }
        }
      }

      // Update last active times
      nextTabs = nextTabs.map(t => {
        if (t.id === nextActiveId) {
          return { ...t, lastActiveTime: Date.now() };
        }
        if (t.id === activeTabId) {
          return { ...t, lastActiveTime: Date.now() };
        }
        return t;
      });

      set({
        tabs: nextTabs,
        activeTabId: nextActiveId,
        cachedTabIds: nextCache
      });

      saveToStorage(nextTabs, nextActiveId);
    },

    closeTab: (id) => {
      const { tabs, activeTabId, cachedTabIds } = get();
      
      const nextTabs = tabs.filter(t => t.id !== id);
      const nextCache = cachedTabIds.filter(cid => cid !== id);
      let nextActiveId = activeTabId;

      if (activeTabId === id) {
        if (nextTabs.length > 0) {
          // Switch to the next available tab (most recently used in cache)
          nextActiveId = nextCache.length > 0 ? nextCache[nextCache.length - 1] : nextTabs[nextTabs.length - 1].id;
        } else {
          nextActiveId = null;
        }
      }

      set({
        tabs: nextTabs,
        activeTabId: nextActiveId,
        cachedTabIds: nextCache
      });

      saveToStorage(nextTabs, nextActiveId);
    },

    pinTab: (id) => {
      const { tabs } = get();
      const nextTabs = tabs.map(t => t.id === id ? { ...t, pinned: !t.pinned } : t);
      
      set({ tabs: nextTabs });
      saveToStorage(nextTabs, get().activeTabId);
    },

    setActiveTab: (id) => {
      const { tabs, activeTabId, cachedTabIds, maxCacheSize } = get();
      if (!tabs.some(t => t.id === id)) return;

      // Handle cache policy for the previously active tab
      let nextCache = [...cachedTabIds];
      if (activeTabId && activeTabId !== id) {
        const prevTab = tabs.find(t => t.id === activeTabId);
        if (prevTab && !prevTab.pinned) {
          const policy = getPageCachePolicy(prevTab.path);
          if (policy === 'suspend') {
            nextCache = nextCache.filter(cid => cid !== activeTabId);
            console.log(`[Workspace Lifecycle] Suspending tab immediately (Policy: Suspend): ${prevTab.title}`);
          }
        }
      }

      // Update LRU cache order
      nextCache = nextCache.filter(cid => cid !== id);
      nextCache.push(id); // Mark as most recently used

      // Evict if cache exceeded
      if (nextCache.length > maxCacheSize) {
        let evictedIndex = 0;
        let foundEvictionCandidate = false;
        while (evictedIndex < nextCache.length - 1) {
          const candidateId = nextCache[evictedIndex];
          const candidateTab = tabs.find(t => t.id === candidateId);
          if (candidateTab && !candidateTab.pinned && candidateId !== id) {
            nextCache = nextCache.filter(cid => cid !== candidateId);
            foundEvictionCandidate = true;
            console.log(`[Workspace Lifecycle] Cache limit exceeded. Evicting/suspending: ${candidateTab.title}`);
            break;
          }
          evictedIndex++;
        }
      }

      // Update last active times
      const nextTabs = tabs.map(t => {
        if (t.id === id) {
          return { ...t, lastActiveTime: Date.now() };
        }
        if (t.id === activeTabId) {
          return { ...t, lastActiveTime: Date.now() };
        }
        return t;
      });

      set({
        tabs: nextTabs,
        activeTabId: id,
        cachedTabIds: nextCache
      });

      saveToStorage(nextTabs, id);
    },

    reorderTabs: (nextTabs) => {
      set({ tabs: nextTabs });
      saveToStorage(nextTabs, get().activeTabId);
    },

    splitTab: (id, splitPath, orientation = 'vertical') => {
      const { tabs } = get();
      const nextTabs = tabs.map(t => {
        if (t.id === id) {
          return {
            ...t,
            splitPath,
            splitOrientation: orientation,
            splitRatio: t.splitRatio || 50
          };
        }
        return t;
      });

      set({ tabs: nextTabs });
      saveToStorage(nextTabs, get().activeTabId);
    },

    setTabState: (id, key, value) => {
      const { tabs } = get();
      const nextTabs = tabs.map(t => {
        if (t.id === id) {
          return {
            ...t,
            serializedState: {
              ...(t.serializedState || {}),
              [key]: value
            }
          };
        }
        return t;
      });

      set({ tabs: nextTabs });
      saveToStorage(nextTabs, get().activeTabId);
    },

    getTabState: (id, key, defaultValue) => {
      const tab = get().tabs.find(t => t.id === id);
      if (tab && tab.serializedState && tab.serializedState[key] !== undefined) {
        return tab.serializedState[key];
      }
      return defaultValue;
    },

    setCacheLimit: (limit) => {
      set({ maxCacheSize: limit });
    },

    setSuspendTimeout: (timeout) => {
      set({ suspendTimeout: timeout });
    },

    checkInactivitySuspension: () => {
      const { tabs, activeTabId, cachedTabIds, suspendTimeout } = get();
      const now = Date.now();
      const nextCache = cachedTabIds.filter(cid => {
        const tab = tabs.find(t => t.id === cid);
        if (!tab) return false;
        
        // Active tab is never suspended
        if (cid === activeTabId) return true;
        // Pinned tabs are never suspended
        if (tab.pinned) return true;
        
        // If inactive time exceeds suspendTimeout (in seconds), suspend it
        const inactiveDuration = now - (tab.lastActiveTime || now);
        if (inactiveDuration > suspendTimeout * 1000) {
          console.log(`[Workspace Lifecycle] Inactivity threshold exceeded (${suspendTimeout}s). Suspending: ${tab.title}`);
          return false;
        }
        return true;
      });

      if (nextCache.length !== cachedTabIds.length) {
        set({ cachedTabIds: nextCache });
      }
    },

    restoreSession: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
            const tabs: Tab[] = parsed.tabs;
            const activeTabId = parsed.activeTabId || tabs[0].id;
            
            // Rebuild cache list based on cache size and policies
            let cachedTabIds = tabs.map(t => t.id);
            if (cachedTabIds.length > get().maxCacheSize) {
              cachedTabIds = cachedTabIds.slice(-get().maxCacheSize);
            }

            set({
              tabs,
              activeTabId,
              cachedTabIds
            });
          }
        }
      } catch (e) {
        console.error('Failed to restore tabs session:', e);
      }
    }
  };
});
