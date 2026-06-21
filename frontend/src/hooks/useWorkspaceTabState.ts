import React, { useContext, useEffect, useState } from 'react';
import { useWorkspaceTabsStore } from '../store/workspaceTabsStore';

export const TabContext = React.createContext<string | null>(null);

export function useWorkspaceTabState<T>(key: string, defaultValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const contextTabId = useContext(TabContext);
  const storeActiveTabId = useWorkspaceTabsStore(state => state.activeTabId);
  const tabId = contextTabId || storeActiveTabId;

  const setTabState = useWorkspaceTabsStore(state => state.setTabState);
  const getTabState = useWorkspaceTabsStore(state => state.getTabState);

  // Initialize state with stored value or default
  const [localState, setLocalState] = useState<T>(() => {
    if (tabId) {
      const saved = getTabState(tabId, key, undefined);
      if (saved !== undefined) return saved;
    }
    return defaultValue;
  });

  // Keep local state in sync if store state changes externally
  useEffect(() => {
    if (tabId) {
      const saved = getTabState(tabId, key, undefined);
      if (saved !== undefined && saved !== localState) {
        setLocalState(saved);
      }
    }
  }, [tabId, key]);

  const setValue = (newValue: T | ((prev: T) => T)) => {
    setLocalState(prev => {
      const nextVal = typeof newValue === 'function' ? (newValue as any)(prev) : newValue;
      if (tabId) {
        setTabState(tabId, key, nextVal);
      }
      return nextVal;
    });
  };

  return [localState, setValue];
}
