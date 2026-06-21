import React, { useRef, Suspense, useEffect } from 'react';
import { useWorkspaceTabsStore } from '../../store/workspaceTabsStore';
import type { Tab } from '../../store/workspaceTabsStore';
import { getComponentForPath } from '../../routes/pageComponents';
import DashboardSkeleton from '../DashboardSkeleton';
import ErrorBoundary from '../ErrorBoundary';
import { Columns, Rows, X } from 'lucide-react';
import { TabContext } from '../../hooks/useWorkspaceTabState';

interface ScrollContainerProps {
  tabId: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

function ScrollContainer({ tabId, className = "w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8", style, children }: ScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const getTabState = useWorkspaceTabsStore(state => state.getTabState);
  const setTabState = useWorkspaceTabsStore(state => state.setTabState);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Restore scroll position
    const savedScroll = getTabState(tabId, '_scrollTop', 0);
    el.scrollTop = savedScroll;

    let timeoutId: any;
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setTabState(tabId, '_scrollTop', el.scrollTop);
      }, 150);
    };

    el.addEventListener('scroll', handleScroll);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [tabId, getTabState, setTabState]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  );
}

export function WorkspaceManager() {
  const { tabs, activeTabId, cachedTabIds } = useWorkspaceTabsStore();

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-erp-bg animate-fade-in">
      {tabs.map((tab) => {
        const isCached = cachedTabIds.includes(tab.id);
        if (!isCached) return null; // Unmounted/Suspended (saves memory, satisfies Lifecycle Manager)

        const isActive = tab.id === activeTabId;
        const Component = getComponentForPath(tab.path);

        return (
          <div
            key={tab.id}
            className="w-full h-full"
            style={{ display: isActive ? 'block' : 'none' }}
          >
            <TabContext.Provider value={tab.id}>
              {Component ? (
                <Suspense fallback={<DashboardSkeleton />}>
                  <ErrorBoundary>
                    {tab.splitPath ? (
                      <SplitPane tab={tab} />
                    ) : (
                      <ScrollContainer tabId={tab.id} className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
                        <div className="max-w-[1600px] mx-auto w-full">
                          <Component tabId={tab.id} />
                        </div>
                      </ScrollContainer>
                    )}
                  </ErrorBoundary>
                </Suspense>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  Page not found or failed to load route path: {tab.path}
                </div>
              )}
            </TabContext.Provider>
          </div>
        );
      })}
    </div>
  );
}

function SplitPane({ tab }: { tab: Tab }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setTabState, splitTab } = useWorkspaceTabsStore();
  const isVertical = tab.splitOrientation !== 'horizontal'; // vertical = left/right, horizontal = top/bottom
  const ratio = tab.splitRatio || 50;

  const LeftComponent = getComponentForPath(tab.path);
  const RightComponent = tab.splitPath ? getComponentForPath(tab.splitPath) : null;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startPos = isVertical ? e.clientX : e.clientY;
    const containerRect = container.getBoundingClientRect();
    const containerSize = isVertical ? containerRect.width : containerRect.height;
    const startRatio = ratio;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentPos = isVertical ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const deltaRatio = (delta / containerSize) * 100;
      
      const nextRatio = Math.max(15, Math.min(85, startRatio + deltaRatio));
      setTabState(tab.id, 'splitRatio', nextRatio);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex select-none relative ${isVertical ? 'flex-row' : 'flex-col'}`}
    >
      {/* Left/Top Panel */}
      <ScrollContainer 
        tabId={`${tab.id}-split-left`}
        className={`overflow-y-auto p-4 sm:p-6 bg-white ${isVertical ? 'border-r border-erp-border' : 'border-b border-erp-border'}`}
        style={{ flexBasis: `${ratio}%`, minWidth: 0, minHeight: 0 }} 
      >
        {LeftComponent && <LeftComponent tabId={tab.id} />}
      </ScrollContainer>

      {/* Resize Splitter Handle */}
      <div
        onPointerDown={handlePointerDown}
        className={`bg-slate-200 hover:bg-blue-500 active:bg-blue-600 transition-all z-20 flex items-center justify-center cursor-col-resize select-none shrink-0 ${
          isVertical ? 'w-1.5 h-full cursor-col-resize' : 'h-1.5 w-full cursor-row-resize'
        }`}
      >
        <div className={`bg-slate-400 w-1 h-4 rounded ${isVertical ? '' : 'rotate-90'}`} />
      </div>

      {/* Right/Bottom Panel */}
      <ScrollContainer 
        tabId={`${tab.id}-split-right`}
        className="overflow-y-auto p-4 sm:p-6 bg-white relative"
        style={{ flexBasis: `${100 - ratio}%`, minWidth: 0, minHeight: 0 }} 
      >
        {/* Split actions toolbar */}
        <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5 bg-slate-100/80 backdrop-blur border border-slate-200/80 p-1 rounded-lg">
          <button 
            onClick={() => splitTab(tab.id, tab.splitPath, isVertical ? 'horizontal' : 'vertical')}
            className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded transition-colors"
            title="Toggle Split Layout Orientation"
          >
            {isVertical ? <Rows className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={() => splitTab(tab.id, undefined)}
            className="p-1 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded transition-colors"
            title="Close Split Screen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {RightComponent ? (
          <RightComponent tabId={`${tab.id}-split-right-inner`} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            Split panel route not found.
          </div>
        )}
      </ScrollContainer>
    </div>
  );
}
