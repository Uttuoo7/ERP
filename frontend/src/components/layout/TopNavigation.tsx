import React, { useEffect, useState } from 'react';
import { MEGA_MENU_CONFIG } from '../../routes/routes.config';
import type { MegaMenuModule } from '../../routes/routes.config';
import { useAuthStore } from '../../store/authStore';
import { EnterprisePlatformSDK } from '../../sdk/EnterprisePlatformSDK';
import { PluginRegistry } from '../../services/PluginRegistry';
import api from '../../api';
import * as Icons from 'lucide-react';
import { ChevronDown } from 'lucide-react';

interface TopNavigationProps {
  activeModuleId: string | null;
  hoveredModuleId: string | null;
  onModuleHover: (id: string | null) => void;
  onModuleClick: (id: string) => void;
}

export function TopNavigation({
  activeModuleId,
  hoveredModuleId,
  onModuleHover,
  onModuleClick
}: TopNavigationProps) {
  const userRole = useAuthStore(state => state.user?.role) || 'EMPLOYEE';
  const [activePlugins, setActivePlugins] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Make sure plugin registry is initialized
    PluginRegistry.initialize();

    // Fetch runtime enabled plugins list from db
    api.get('/api/saas/plugins/state')
      .then(res => {
        const enabledKeys = new Set<string>(
          res.data.filter((ds: any) => ds.enabled).map((ds: any) => ds.plugin_key)
        );
        setActivePlugins(enabledKeys);
      })
      .catch(err => {
        console.error("Failed to load active plugins for navigation mapping:", err);
      });
  }, []);

  // Merge static config with SDK-registered plugins
  const allModules: MegaMenuModule[] = [...MEGA_MENU_CONFIG];
  
  // Register dynamic plugins routes
  const registeredPlugins = EnterprisePlatformSDK.getPlugins();
  registeredPlugins.forEach(p => {
    const isDbEnabled = activePlugins.has(p.key);
    if (isDbEnabled && !allModules.some(m => m.id === p.key)) {
      // Build MegaMenuModule layout dynamically from plugin manifest
      allModules.push({
        id: p.key,
        title: p.key.replace('_', ' ').toUpperCase(),
        icon: p.key === 'procurement' ? 'ShoppingBag' : p.key === 'inventory' ? 'Boxes' : p.key === 'finance' ? 'Landmark' : 'Layers',
        roles: [],
        categories: p.megaMenu?.map(mm => ({
          title: mm.cardTitle,
          icon: mm.cardIcon,
          description: mm.cardDescription,
          links: mm.links
        }))
      });
    }
  });

  // Filter modules based on role
  const authorizedModules = allModules.filter(mod => {
    if (userRole === 'SUPER_ADMIN') return true;
    if (mod.disabled) return true; // Show CRM/HR greyed out
    
    // Check if it is a dynamic plugin and verify if it's enabled in DB
    const isPlugin = registeredPlugins.some(p => p.key === mod.id);
    if (isPlugin && !activePlugins.has(mod.id)) {
      return false;
    }
    
    return mod.roles.length === 0 || mod.roles.includes(userRole);
  });

  return (
    <nav className="hidden lg:flex items-center gap-1 h-full mx-6 select-none font-sans">
      {authorizedModules.map((mod) => {
        const IconComponent = (Icons as any)[mod.icon] || Icons.Circle;
        const isActive = mod.id === activeModuleId;
        const isHovered = mod.id === hoveredModuleId;
        const isDisabled = mod.disabled;

        return (
          <div
            key={mod.id}
            onMouseEnter={() => !isDisabled && onModuleHover(mod.id)}
            className="relative h-full flex items-center"
          >
            <button
              onClick={() => {
                if (isDisabled) return;
                onModuleClick(mod.id);
              }}
              disabled={isDisabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                isDisabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : isActive
                  ? 'bg-blue-50 text-blue-600'
                  : isHovered
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={isDisabled ? `${mod.title} module disabled (License required)` : undefined}
            >
              <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
              <span>{mod.title}</span>
              {!isDisabled && mod.categories && mod.categories.length > 0 && (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              )}

              {isDisabled && (
                <span className="absolute -top-1 -right-1.5 px-1 py-0.2 bg-slate-200 text-[8px] font-black text-slate-500 rounded uppercase tracking-wider scale-75 select-none">
                  Locked
                </span>
              )}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
