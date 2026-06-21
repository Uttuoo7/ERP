import React, { useEffect } from 'react';
import { useWorkspaceTabsStore } from '../../store/workspaceTabsStore';
import type { Tab } from '../../store/workspaceTabsStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  X, Pin, Columns, Rows, Copy, ChevronLeft, ChevronRight, RefreshCw, Star
} from 'lucide-react';
import toast from 'react-hot-toast';

export function WorkspaceTabs() {
  const { 
    tabs, 
    activeTabId, 
    openTab, 
    closeTab, 
    pinTab, 
    setActiveTab, 
    reorderTabs,
    splitTab,
    restoreSession 
  } = useWorkspaceTabsStore();

  const navigate = useNavigate();
  const location = useLocation();

  // Restore session tabs on mount
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Effect 1: When the active tab changes in the store, sync URL to match it.
  // We track the last path we navigated to so Effect 2 can ignore it.
  const lastNavigatedPath = React.useRef<string | null>(null);

  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.path !== location.pathname) {
      lastNavigatedPath.current = activeTab.path;
      navigate(activeTab.path);
    }
  }, [activeTabId]);

  // Effect 2: When the URL changes externally (back/forward, direct link, megamenu navigate()),
  // sync the tab store to match. Skip if this was a URL change we ourselves triggered.
  useEffect(() => {
    const cleanPath = location.pathname;
    if (cleanPath.startsWith('/login') || cleanPath.startsWith('/portal')) return;

    // If we triggered this navigation ourselves (Effect 1), ignore it
    if (lastNavigatedPath.current === cleanPath) {
      lastNavigatedPath.current = null;
      return;
    }

    const existingTab = tabs.find(t => t.path === cleanPath);
    if (!existingTab) {
      let title = 'Workspace';
      if (cleanPath === '/dashboard') title = 'Dashboard';
      else {
        const segments = cleanPath.split('/').filter(Boolean);
        if (segments.length > 0) {
          title = segments[segments.length - 1]
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        }
      }
      openTab(cleanPath, title);
    } else if (existingTab.id !== activeTabId) {
      setActiveTab(existingTab.id);
    }
  }, [location.pathname]);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab.id);
  };

  const handleDuplicateTab = (tab: Tab, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPath = `${tab.path}?dup=${Date.now()}`;
    openTab(cleanPath, `${tab.title} (Copy)`);
    toast.success('Tab duplicated.');
  };

  const handleSplitTab = (tab: Tab, e: React.MouseEvent, orientation: 'vertical' | 'horizontal') => {
    e.stopPropagation();
    // Default split splits with dashboard or a summary
    splitTab(tab.id, '/analytics', orientation);
    toast.success(`Split screen opened (${orientation}).`);
  };

  const moveTab = (index: number, direction: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tabs.length) return;

    const nextTabs = [...tabs];
    const temp = nextTabs[index];
    nextTabs[index] = nextTabs[newIndex];
    nextTabs[newIndex] = temp;
    reorderTabs(nextTabs);
  };

  if (tabs.length === 0) return null;

  return (
    <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 justify-between shrink-0 select-none font-sans overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1.5 h-full">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`group flex items-center gap-2 h-[34px] px-3.5 mt-1.5 rounded-t-xl border-t border-x text-xs font-bold transition-all cursor-pointer relative ${
                isActive
                  ? 'bg-white border-slate-200 text-blue-600 shadow-sm shadow-blue-50/20'
                  : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {tab.pinned && <Pin className="w-3 h-3 text-blue-500 shrink-0 rotate-45" />}
              <span className="truncate max-w-[120px]">{tab.title}</span>

              {/* Tab Actions Toolbar (Visible on hover) */}
              <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                {idx > 0 && (
                  <button 
                    onClick={(e) => moveTab(idx, 'left', e)}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                    title="Move Left"
                  >
                    <ChevronLeft className="w-2.5 h-2.5" />
                  </button>
                )}
                {idx < tabs.length - 1 && (
                  <button 
                    onClick={(e) => moveTab(idx, 'right', e)}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                    title="Move Right"
                  >
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                )}
                <button 
                  onClick={(e) => pinTab(tab.id)}
                  className={`p-0.5 hover:bg-slate-200 rounded ${tab.pinned ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
                  title={tab.pinned ? 'Unpin Tab' : 'Pin Tab'}
                >
                  <Pin className="w-2.5 h-2.5" />
                </button>
                <button 
                  onClick={(e) => handleDuplicateTab(tab, e)}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                  title="Duplicate Tab"
                >
                  <Copy className="w-2.5 h-2.5" />
                </button>
                {!tab.splitPath && (
                  <button 
                    onClick={(e) => handleSplitTab(tab, e, 'vertical')}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                    title="Split Panel Right"
                  >
                    <Columns className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Close Button */}
              {(!tab.pinned || tabs.length === 1) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-rose-600 shrink-0 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Global Tab controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => {
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab) {
              // Trigger simple window reload simulation or tab key refreshes
              toast.success('Workspace view refreshed.');
            }
          }}
          className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          title="Refresh current workspace"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
