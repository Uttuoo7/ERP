import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNavigation } from './TopNavigation';
import { MegaMenu } from './MegaMenu';
import { QuickAccessMenu } from './QuickAccessMenu';
import { useUIStore } from '../../store/uiStore';
import { useDockableStore } from '../../store/dockableStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useThemeStore } from '../../store/themeStore';
import type { EnterpriseTheme } from '../../store/themeStore';
import { useEnterpriseContext } from './EnterpriseContextProvider';
import { useAuthStore } from '../../store/authStore';
import { 
  Search, Bell, Star, Clock, Palette, HelpCircle, User, LogOut, ChevronDown, Check, LayoutGrid 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AppHeaderProps {
  activeModuleId: string | null;
  hoveredModuleId: string | null;
  onModuleHover: (id: string | null) => void;
  onModuleClick: (id: string) => void;
  onHelpClick: () => void;
}

export function AppHeader({
  activeModuleId,
  hoveredModuleId,
  onModuleHover,
  onModuleClick,
  onHelpClick
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { setCommandPaletteOpen } = useUIStore();
  const { openPanel, activePanel, closePanel, isOpen: isDockPanelOpen } = useDockableStore();
  const { theme, setTheme } = useThemeStore();
  const { favorites, recents } = useNavigationStore();
  const { company, setCompanyContext } = useEnterpriseContext();
  const logout = useAuthStore(state => state.logout);

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFavOpen, setIsFavOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);

  const themeRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const favRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (themeRef.current && !themeRef.current.contains(target)) setIsThemeOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);
      if (favRef.current && !favRef.current.contains(target)) setIsFavOpen(false);
      if (recentRef.current && !recentRef.current.contains(target)) setIsRecentOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleAlertsClick = () => {
    if (isDockPanelOpen && activePanel === 'notifications') {
      closePanel();
    } else {
      openPanel('notifications');
    }
  };

  const handleNav = (path: string) => {
    navigate(path);
    setIsFavOpen(false);
    setIsRecentOpen(false);
  };

  const handleThemeChange = (t: EnterpriseTheme) => {
    setTheme(t);
    setIsThemeOpen(false);
    toast.success(`Theme updated to ${t.replace('-', ' ')}.`);
  };

  const handleCompanySwitch = (corp: string, wh: string) => {
    setCompanyContext({ company: corp, warehouse: wh });
    setIsProfileOpen(false);
    toast.success(`Switched corporate context to ${corp}`);
  };

  const themeOptions: { value: EnterpriseTheme; label: string }[] = [
    { value: 'light', label: 'Light Mode' },
    { value: 'dark', label: 'Dark Mode' },
    { value: 'enterprise-blue', label: 'Enterprise Blue' },
    { value: 'professional-gray', label: 'Professional Gray' },
    { value: 'high-contrast', label: 'High Contrast' }
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 select-none relative font-sans shadow-sm z-50">
      {/* 1. Left branding details */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
          <LayoutGrid className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-black text-slate-800 tracking-wider uppercase">Antigravity ERP</h1>
          <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">Desktop Shell</p>
        </div>
      </div>

      {/* 2. Top-level modules navigation (Center horizontal list) */}
      <TopNavigation
        activeModuleId={activeModuleId}
        hoveredModuleId={hoveredModuleId}
        onModuleHover={onModuleHover}
        onModuleClick={onModuleClick}
      />

      {/* 3. Right side toolbar utilities */}
      <div className="flex items-center gap-2">
        {/* Ctrl+K Search */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 p-2 hover:bg-slate-100/80 text-slate-400 hover:text-slate-700 rounded-xl transition border border-slate-200/50"
          title="Open Search / Commands (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
          <kbd className="hidden sm:inline-block text-[9px] font-mono border border-slate-200 px-1 bg-slate-50 rounded">
            Ctrl+K
          </kbd>
        </button>

        {/* Global Quick Action menu (+ trigger) */}
        <QuickAccessMenu />

        {/* Notifications / Alerts center */}
        <button
          onClick={handleAlertsClick}
          className={`p-2 rounded-xl transition border ${
            isDockPanelOpen && activePanel === 'notifications'
              ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 border-slate-200/50 hover:bg-slate-100/80 bg-white'
          }`}
          title="Toggle System alerts panel"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Favorites manager dropdown */}
        <div ref={favRef} className="relative">
          <button
            onClick={() => setIsFavOpen(!isFavOpen)}
            className={`p-2 rounded-xl transition border ${
              isFavOpen ? 'bg-amber-50 text-amber-600 border-amber-200' : 'text-slate-500 border-slate-200/50 hover:bg-slate-100/80'
            }`}
            title="Favorites Shortcuts"
          >
            <Star className="w-4 h-4" />
          </button>
          {isFavOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-scale-in text-slate-800">
              <div className="px-3.5 pb-2 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Favorites
              </div>
              <div className="flex flex-col gap-0.5 mt-1.5 max-h-[220px] overflow-y-auto">
                {favorites.length === 0 ? (
                  <span className="text-[10px] text-slate-400 font-semibold px-3.5 py-2 italic text-center">No favorites pinned yet.</span>
                ) : (
                  favorites.map((path) => (
                    <button
                      key={path}
                      onClick={() => handleNav(path)}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 text-slate-600 hover:text-blue-600 truncate"
                    >
                      {path.split('/').filter(Boolean).pop()?.toUpperCase() || 'Dashboard'}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recent pages list */}
        <div ref={recentRef} className="relative">
          <button
            onClick={() => setIsRecentOpen(!isRecentOpen)}
            className={`p-2 rounded-xl transition border ${
              isRecentOpen ? 'bg-slate-100 text-slate-800 border-slate-300' : 'text-slate-500 border-slate-200/50 hover:bg-slate-100/80'
            }`}
            title="Recent views history"
          >
            <Clock className="w-4 h-4" />
          </button>
          {isRecentOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-scale-in text-slate-800">
              <div className="px-3.5 pb-2 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Recent views
              </div>
              <div className="flex flex-col gap-0.5 mt-1.5 max-h-[220px] overflow-y-auto">
                {recents.length === 0 ? (
                  <span className="text-[10px] text-slate-400 font-semibold px-3.5 py-2 italic text-center">No recent entries.</span>
                ) : (
                  recents.map((rec) => (
                    <button
                      key={rec.path}
                      onClick={() => handleNav(rec.path)}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 text-slate-600 hover:text-blue-600 truncate"
                    >
                      {rec.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Manager selector dropdown */}
        <div ref={themeRef} className="relative">
          <button
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl transition-all flex items-center justify-center bg-white"
            title="UI Theme Manager"
          >
            <Palette className="w-4 h-4" />
          </button>
          {isThemeOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-scale-in text-slate-800">
              <div className="px-3.5 pb-1.5 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Select Theme
              </div>
              <div className="flex flex-col gap-0.5 mt-1.5">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleThemeChange(opt.value)}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 flex items-center justify-between text-slate-600 hover:text-blue-600"
                  >
                    <span>{opt.label}</span>
                    {theme === opt.value && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Help Dialog shortcut */}
        <button
          onClick={onHelpClick}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200/50 rounded-xl transition bg-white"
          title="Keyboard Shortcuts Reference Guide (F1)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Profile and Multi-company Switcher (Component Mandatory Revision 2) */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-1.5 p-1 px-2.5 hover:bg-slate-100 border border-slate-200 rounded-xl bg-white transition cursor-pointer"
            title="Switch corporate context"
          >
            <User className="w-4 h-4 text-slate-500" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-scale-in text-slate-800">
              <div className="px-3.5 pb-1.5 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Active Organization Context
              </div>
              
              {/* Profile Details */}
              <div className="p-3 border-b border-slate-100 flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Current Corporate</span>
                <span className="text-xs font-black text-slate-800">{company}</span>
              </div>

              {/* Multi-Company switch options */}
              <div className="p-1 flex flex-col gap-0.5">
                <button
                  onClick={() => handleCompanySwitch('Apex Global Industries Ltd', 'WH-01 Main Vault')}
                  className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-slate-50 text-slate-600 hover:text-blue-600"
                >
                  Switch to: Apex Global (Mumbai)
                </button>
                <button
                  onClick={() => handleCompanySwitch('Antigravity Logistics Corp', 'WH-02 Secondary Hub')}
                  className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-slate-50 text-slate-600 hover:text-blue-600"
                >
                  Switch to: Antigravity Logistics (Delhi)
                </button>
              </div>

              <div className="border-t border-slate-100 mt-2 pt-1">
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Log Out Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Horizontal MegaMenu Dropdown (rendered conditionally underneath header) */}
      {hoveredModuleId && (
        <MegaMenu
          moduleId={hoveredModuleId}
          onClose={() => onModuleHover(null)}
        />
      )}
    </header>
  );
}
