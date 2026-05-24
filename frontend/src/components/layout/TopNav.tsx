import React from 'react';
import NotificationDropdown from '../NotificationDropdown';
import { Search, Menu } from 'lucide-react';

interface TopNavProps {
  onMenuClick?: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  return (
    <header className="h-16 px-4 md:px-6 flex items-center justify-between shrink-0 bg-white border-b border-slate-200">
      <div className="flex items-center flex-1 max-w-md">
        {/* Hamburger Menu (Mobile Only) */}
        <button 
          className="md:hidden p-2 mr-2 -ml-2 text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Command Palette Mockup */}
        <div className="relative group w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-all shadow-sm inset-shadow-sm"
            placeholder="Search POs, Invoices, or Commands... (Cmd+K)"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <kbd className="inline-flex items-center border border-slate-200 rounded px-1.5 text-[10px] font-sans font-medium text-slate-400 bg-white">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        <NotificationDropdown />
      </div>
    </header>
  );
}
