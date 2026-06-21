import { RIBBON_CONFIG } from '../../routes/routes.config';
import type { RibbonGroup } from '../../routes/routes.config';
import { useHeaderStore } from '../../store/headerStore';
import { useNavigate } from 'react-router-dom';
import { EnterprisePlatformSDK } from '../../sdk/EnterprisePlatformSDK';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

interface RibbonToolbarProps {
  activeModuleId: string | null;
}

export function RibbonToolbar({ activeModuleId }: RibbonToolbarProps) {
  const navigate = useNavigate();
  const headerStore = useHeaderStore();

  const currentModuleId = activeModuleId?.toLowerCase() || '';
  
  // Merge static ribbon config with dynamically registered plugin ribbons
  const dynamicGroups: RibbonGroup[] = [];
  const registeredPlugins = EnterprisePlatformSDK.getPlugins();
  const matchingPlugin = registeredPlugins.find(p => p.key === currentModuleId);
  
  if (matchingPlugin && matchingPlugin.ribbon) {
    matchingPlugin.ribbon.forEach(rib => {
      dynamicGroups.push({
        title: rib.groupLabel,
        buttons: rib.buttons.map(b => ({
          label: b.label,
          icon: b.icon,
          path: undefined,
          actionKey: b.actionKey
        }))
      });
    });
  }

  const standardGroups = [...(RIBBON_CONFIG[currentModuleId] || []), ...dynamicGroups];

  const handleActionClick = (path?: string, actionKey?: string) => {
    if (path) {
      navigate(path);
    } else if (actionKey) {
      toast.success(`Executed SDK action: ${actionKey}`);
    }
  };

  // Skip rendering the ribbon if there are no configured module groups AND no page-level actions
  const hasPageActions = !!headerStore.actions || !!headerStore.secondaryActions;
  const hasRibbonContent = standardGroups.length > 0 || hasPageActions;

  if (!hasRibbonContent) {
    // Render a minimal spacer to maintain the desktop application layout grid cleanly
    return <div className="h-2 bg-slate-50 border-b border-slate-200 shrink-0" />;
  }

  return (
    <div className="h-18 bg-slate-50 border-b border-slate-200 flex items-center px-6 gap-6 select-none shrink-0 font-sans overflow-x-auto scrollbar-none shadow-inner-top">
      {/* 1. Render standard module-level Ribbon actions defined in routes configuration */}
      {standardGroups.map((group: RibbonGroup, idx: number) => (
        <div key={idx} className="flex flex-col h-full justify-between py-1.5 border-r border-slate-200/80 pr-6 last:border-0">
          <div className="flex items-center gap-3">
            {group.buttons.map((btn, btnIdx) => {
              const BtnIcon = (Icons as any)[btn.icon] || Icons.Circle;
              return (
                <button
                  key={btnIdx}
                  onClick={() => handleActionClick(btn.path, (btn as any).actionKey)}
                  className="flex flex-col items-center justify-center p-1 px-2.5 rounded-lg hover:bg-slate-100 hover:text-blue-600 transition-all cursor-pointer group"
                >
                  <BtnIcon className="w-4 h-4 text-slate-500 group-hover:text-blue-500 transition-colors" />
                  <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors mt-1">
                    {btn.label}
                  </span>
                </button>
              );
            })}
          </div>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">
            {group.title}
          </span>
        </div>
      ))}

      {/* 2. Contextual page-level actions section (replaces page action buttons) */}
      {hasPageActions && (
        <div className="flex flex-col h-full justify-between py-1.5 border-r border-slate-200/80 pr-6 last:border-0">
          <div className="flex items-center gap-3 h-full">
            {headerStore.actions && (
              <div className="flex items-center gap-2">
                {headerStore.actions}
              </div>
            )}
            {headerStore.secondaryActions && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                {headerStore.secondaryActions}
              </div>
            )}
          </div>
          <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest text-center mt-1">
            Active View Operations
          </span>
        </div>
      )}
    </div>
  );
}
