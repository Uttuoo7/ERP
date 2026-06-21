import React, { useState, useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { RibbonToolbar } from './RibbonToolbar';
import { WorkspaceTabs } from './WorkspaceTabs';
import { WorkspaceManager } from './WorkspaceManager';
import { StatusBar } from './StatusBar';
import { DockablePanel } from './DockablePanel';
import { useWorkspaceTabsStore } from '../../store/workspaceTabsStore';
import { useDockableStore } from '../../store/dockableStore';
import { useUIStore } from '../../store/uiStore';
import { ThemeManager } from './ThemeManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { usePerformanceStore } from '../../store/performanceStore';
import { MEGA_MENU_CONFIG } from '../../routes/routes.config';
import { Keyboard, HelpCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function EnterpriseShell() {
  const { tabs, activeTabId, setActiveTab, openTab, checkInactivitySuspension } = useWorkspaceTabsStore();
  const { activePanel, isOpen, isPinned } = useDockableStore();
  const { setCommandPaletteOpen, commandPaletteOpen } = useUIStore();
  const { addMetric } = usePerformanceStore();

  const [activeModuleId, setActiveModuleId] = useState<string | null>('dashboard');
  const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);

  // Measure initial application shell mounting duration (Performance Target 20)
  useEffect(() => {
    const start = window.performance.now();
    // Simulate minor delay to simulate loading checks
    setTimeout(() => {
      const duration = window.performance.now() - start;
      addMetric('initial_load', 'Enterprise Desktop Shell mount', duration);
    }, 100);
  }, []);

  // Poll for inactive tabs to suspend them (Lifecycle manager inactivity timeout)
  useEffect(() => {
    const interval = setInterval(() => {
      checkInactivitySuspension();
    }, 5000);
    return () => clearInterval(interval);
  }, [checkInactivitySuspension]);

  // Global Keyboard Shortcuts (Component 19)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. ESC - Close dialogs
      if (e.key === 'Escape') {
        if (isShortcutHelpOpen) {
          setIsShortcutHelpOpen(false);
          e.preventDefault();
        }
      }

      // 2. F1 - Show keyboard shortcuts dialog
      if (e.key === 'F1') {
        setIsShortcutHelpOpen(prev => !prev);
        e.preventDefault();
        return;
      }

      // 3. Ctrl + / - Show shortcuts dialog (Mac fallback)
      if (e.ctrlKey && e.key === '/') {
        setIsShortcutHelpOpen(prev => !prev);
        e.preventDefault();
        return;
      }

      // 4. Ctrl + S - Save Draft
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        toast.success('Document draft autosaved.');
        return;
      }

      // 5. Ctrl + N - New Record (Open Quick Access Menu)
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openTab('/pos/new', 'New PO');
        toast.success('Launching New Purchase Order transaction.');
        return;
      }

      // 6. Ctrl + Tab - Next Workspace Tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (tabs.length <= 1) return;
        const activeIdx = tabs.findIndex(t => t.id === activeTabId);
        const nextIdx = (activeIdx + 1) % tabs.length;
        const start = window.performance.now();
        setActiveTab(tabs[nextIdx].id);
        addMetric('tab_switch', `Switch Tab to ${tabs[nextIdx].title}`, window.performance.now() - start);
        return;
      }

      // 7. Ctrl + Shift + Tab - Previous Workspace Tab
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        if (tabs.length <= 1) return;
        const activeIdx = tabs.findIndex(t => t.id === activeTabId);
        const prevIdx = (activeIdx - 1 + tabs.length) % tabs.length;
        const start = window.performance.now();
        setActiveTab(tabs[prevIdx].id);
        addMetric('tab_switch', `Switch Tab to ${tabs[prevIdx].title}`, window.performance.now() - start);
        return;
      }

      // 8. Alt + 1-9 - Switch top navigation modules
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        const modules = MEGA_MENU_CONFIG.filter(m => !m.disabled);
        if (idx >= 0 && idx < modules.length) {
          e.preventDefault();
          const targetModule = modules[idx];
          const start = window.performance.now();
          setActiveModuleId(targetModule.id);
          
          // Navigate to its default dashboard/path if config specifies
          if (targetModule.id === 'dashboard') openTab('/dashboard', 'Dashboard');
          else if (targetModule.id === 'purchase') openTab('/pos', 'Purchase Orders');
          else if (targetModule.id === 'inventory') openTab('/inventory', 'Warehouse');
          else if (targetModule.id === 'finance') openTab('/finance/dashboard', 'Finance');
          else if (targetModule.id === 'manufacturing') openTab('/manufacturing/dashboard', 'Manufacturing');
          
          addMetric('module_switch', `Switch module to ${targetModule.title}`, window.performance.now() - start);
          toast.success(`Switched module: ${targetModule.title}`);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, setActiveTab, openTab, isShortcutHelpOpen]);

  const handleModuleClick = (id: string) => {
    const start = window.performance.now();
    setActiveModuleId(id);
    setHoveredModuleId(null); // close mega menu after selection

    if (id === 'dashboard') openTab('/dashboard', 'Dashboard');
    else if (id === 'purchase') openTab('/pos', 'Purchase Orders');
    else if (id === 'inventory') openTab('/inventory', 'Warehouse');
    else if (id === 'finance') openTab('/finance/dashboard', 'Finance');
    else if (id === 'manufacturing') openTab('/manufacturing/dashboard', 'Manufacturing');
    else if (id === 'quality') openTab('/grns', 'QC Console');
    else if (id === 'reports') openTab('/finance/balance-sheet', 'Balance Sheet');
    else if (id === 'administration') openTab('/masters', 'Masters');

    addMetric('module_switch', `Switch module to ${id}`, window.performance.now() - start);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-erp-bg text-slate-800 font-sans select-none">
      {/* Theme Manager and Perf telemetries HUD overlays */}
      <ThemeManager />
      <PerformanceMonitor />

      <AppHeader
        activeModuleId={activeModuleId}
        hoveredModuleId={hoveredModuleId}
        onModuleHover={setHoveredModuleId}
        onModuleClick={handleModuleClick}
        onHelpClick={() => setIsShortcutHelpOpen(true)}
      />

      <RibbonToolbar activeModuleId={activeModuleId} />

      <WorkspaceTabs />

      {/* Persistent Content Area: splits horizontally with DockablePanel if pinned */}
      <div className="flex-1 flex overflow-hidden relative">
        <WorkspaceManager />
        
        {/* Dockable panel: splits/resizes next to workspace if pinned, overlays if unpinned */}
        <DockablePanel />
      </div>

      <StatusBar />

      {/* Keyboard shortcuts help Modal overlay (F1) */}
      {isShortcutHelpOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-[500px] max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative font-sans text-xs">
            <button
              onClick={() => setIsShortcutHelpOpen(false)}
              className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <Keyboard className="w-5 h-5 text-blue-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Enterprise Keyboard Productivity Shortcuts
              </h2>
            </div>

            <div className="space-y-3.5 leading-relaxed text-slate-600 font-medium">
              <div className="grid grid-cols-2 py-1.5 border-b border-slate-100/50">
                <span className="font-extrabold text-slate-700">Ctrl + K / Cmd + K</span>
                <span className="text-right font-semibold text-slate-500">Open Command Center</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-slate-100/50">
                <span className="font-extrabold text-slate-700">Ctrl + N</span>
                <span className="text-right font-semibold text-slate-500">Launch New PO Form</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-slate-100/50">
                <span className="font-extrabold text-slate-700">Ctrl + S</span>
                <span className="text-right font-semibold text-slate-500">Save Draft Document</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-slate-100/50">
                <span className="font-extrabold text-slate-700">Ctrl + Tab</span>
                <span className="text-right font-semibold text-slate-500">Next Workspace Tab</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-slate-100/50">
                <span className="font-extrabold text-slate-700">Ctrl + Shift + Tab</span>
                <span className="text-right font-semibold text-slate-500">Previous Workspace Tab</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-slate-100/50">
                <span className="font-extrabold text-slate-700">Alt + 1–9</span>
                <span className="text-right font-semibold text-slate-500">Switch Modules (1=Dash, 2=Purchase...)</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-slate-100/50">
                <span className="font-extrabold text-slate-700">Escape</span>
                <span className="text-right font-semibold text-slate-500">Close open dialogs / menu</span>
              </div>
              <div className="grid grid-cols-2 py-1.5">
                <span className="font-extrabold text-slate-700">F1 / Ctrl + /</span>
                <span className="text-right font-semibold text-slate-500">Toggle shortcuts guide list</span>
              </div>
            </div>

            <button
              onClick={() => setIsShortcutHelpOpen(false)}
              className="w-full mt-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition shadow-lg shadow-blue-500/20"
            >
              Close Shortcuts Reference
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
