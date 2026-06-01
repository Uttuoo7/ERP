import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from "../../store/authStore";
import { Package, Inbox, FileText, CheckSquare, Bell, LogOut, BarChart3, Home } from 'lucide-react';
import NotificationDropdown from '../NotificationDropdown';

export function VendorLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const userEmail = useAuthStore(state => state.user?.email);

  const navItems = [
    { name: 'Command Center', path: '/portal/dashboard', icon: <Home className="w-5 h-5" /> },
    { name: 'RFQ Inbox', path: '/portal/rfqs', icon: <Inbox className="w-5 h-5" /> },
    { name: 'Purchase Orders', path: '/portal/pos', icon: <Package className="w-5 h-5" /> },
    { name: 'Invoices & Payments', path: '/portal/invoices', icon: <FileText className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0 text-slate-300">
        <div className="h-20 px-6 flex flex-col justify-center border-b border-slate-800 shrink-0">
          <h2 className="text-xl font-black text-white tracking-tight">Supplier Portal</h2>
          <p className="text-xs text-slate-500 truncate mt-1">{userEmail}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 mt-4">
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium hover:bg-slate-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center text-slate-800 font-semibold text-lg">
            {navItems.find(n => location.pathname.startsWith(n.path))?.name || 'Workspace'}
          </div>
          <div className="flex items-center gap-4">
            <NotificationDropdown />
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              {userEmail?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
