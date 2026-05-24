import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { MobileBottomNav } from './MobileBottomNav';
import { Drawer } from 'antd';
import { useWebSocketStore } from '../../store/websocketStore';
import { useAuthStore } from '../../store/authStore';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { connect, disconnect } = useWebSocketStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      connect(user.id);
    }
    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      <Drawer
        placement="left"
        closable={true}
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        styles={{ body: { padding: 0 } }}
        width={280}
      >
        <Sidebar />
      </Drawer>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 mb-16 md:mb-0">
        <TopNav onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-6">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
