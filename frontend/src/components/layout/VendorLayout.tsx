import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Home, Inbox, Package, FileText, CreditCard, FolderOpen,
  LogOut, ChevronRight, Shield, Menu, X,
} from 'lucide-react';
import NotificationDropdown from '../NotificationDropdown';

/* ═══════════════════════════════════════════════════════════════════════════
   VendorLayout — Isolated Supplier Portal Shell
   ─────────────────────────────────────────────────────────────────────────
   Completely separate from internal ERP MainLayout.
   No ERP navigation exposed. Only vendor-scoped routes visible.
   ═══════════════════════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { name: 'Dashboard',         path: '/portal/dashboard',  icon: Home },
  { name: 'RFQ Inbox',         path: '/portal/rfqs',       icon: Inbox },
  { name: 'Purchase Orders',   path: '/portal/pos',        icon: Package },
  { name: 'Invoices',          path: '/portal/invoices',    icon: FileText },
  { name: 'Payments',          path: '/portal/payments',    icon: CreditCard },
  { name: 'Documents',         path: '/portal/documents',   icon: FolderOpen },
];

export function VendorLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const activePage = NAV_ITEMS.find(n => location.pathname.startsWith(n.path));

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="h-20 px-6 flex flex-col justify-center border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-tight leading-tight">Supplier Portal</h2>
            <p className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase">P2P ERP</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 mt-2">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.name}
              {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="px-4">
          <p className="text-xs font-bold text-slate-400 truncate">{user?.email}</p>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Vendor Account</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 flex-col shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-slate-900 flex flex-col z-50 shadow-2xl animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-lg"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold text-slate-900">{activePage?.name || 'Portal'}</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationDropdown />
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200">
              {user?.email?.[0]?.toUpperCase() || 'V'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
