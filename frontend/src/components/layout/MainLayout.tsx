import React from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <TopNav />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
