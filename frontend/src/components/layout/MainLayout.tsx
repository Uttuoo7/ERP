import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { MobileBottomNav } from './MobileBottomNav';
import { useWebSocketStore } from '../../store/websocketStore';
import { useHeaderStore } from '../../store/headerStore';
import { useAuthStore } from '../../store/authStore';
import { PageHeader } from './PageHeader';
import { useLocation, matchPath } from 'react-router-dom';
import { ERP_ROUTES, getRouteMetadata } from '../../routes/routes.config';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { connect, disconnect } = useWebSocketStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerStore = useHeaderStore();
  const location = useLocation();

  useEffect(() => {
    if (user?.id) {
      connect(user.id);
    }
    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  // Derive active route metadata
  const activeRouteMeta = getRouteMetadata(location.pathname);

  // Merge page-level overrides with static route metadata
  const activeTitle = headerStore.title || activeRouteMeta?.title;
  const activeDescription = headerStore.description !== undefined ? headerStore.description : activeRouteMeta?.description;
  const activeBreadcrumbs = headerStore.breadcrumbs || activeRouteMeta?.breadcrumbs;

  return (
    <div className="flex h-screen bg-erp-bg overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer container */}
          <div className="relative flex w-[280px] max-w-xs flex-col bg-white shadow-2xl z-50 border-r border-slate-100 animate-slide-in">
            <div className="absolute right-4 top-4 z-50">
              <button 
                type="button" 
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-full overflow-y-auto pt-4">
              <Sidebar />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-erp-bg mb-16 md:mb-0">
        <TopNav onMenuClick={() => setMobileMenuOpen(true)} />
        
        {/* Global Page Header Area */}
        {activeTitle && (
          <div className="bg-white px-4 sm:px-6 lg:px-8 py-5 border-b border-erp-border shrink-0 z-10 shadow-sm">
            <div className="max-w-[1600px] mx-auto w-full">
              <PageHeader 
                title={activeTitle} 
                description={activeDescription}
                breadcrumbs={activeBreadcrumbs}
                actions={headerStore.actions}
                secondaryActions={headerStore.secondaryActions}
                recentItems={headerStore.recentItems}
              />
            </div>
          </div>
        )}

        {/* Global Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
