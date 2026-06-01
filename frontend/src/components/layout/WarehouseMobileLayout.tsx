import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Package, Inbox, ScanBarcode } from 'lucide-react';
import NotificationDropdown from '../NotificationDropdown';

interface WarehouseMobileLayoutProps {
  children: React.ReactNode;
}

export function WarehouseMobileLayout({ children }: WarehouseMobileLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Top Nav */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center">
            <ScanBarcode className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-800 tracking-tight">Warehouse</span>
        </div>
        <div>
          <NotificationDropdown />
        </div>
      </header>

      {/* Main Content Area (scrollable) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-16 bg-white border-t border-slate-200 flex justify-around items-center shrink-0 px-2 pb-safe">
        <NavLink 
          to="/warehouse/home" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-semibold tracking-wide">Home</span>
        </NavLink>

        <NavLink 
          to="/warehouse/grn" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Package className="w-6 h-6" />
          <span className="text-[10px] font-semibold tracking-wide">GRN</span>
        </NavLink>

        <NavLink 
          to="/warehouse/transfers" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Inbox className="w-6 h-6" />
          <span className="text-[10px] font-semibold tracking-wide">Transfers</span>
        </NavLink>
      </nav>
    </div>
  );
}
