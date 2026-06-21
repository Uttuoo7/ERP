import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from "../../store/authStore";
import { useNavigationStore } from "../../store/navigationStore";
import { ERP_ROUTES } from '../../routes/routes.config';
import * as Icons from 'lucide-react';
import { ChevronDown, ChevronRight, Star, Clock, Menu } from 'lucide-react';

interface SidebarLinkProps {
  to: string;
  iconName: string;
  children: React.ReactNode;
  collapsed?: boolean;
}

function SidebarLink({ to, iconName, children, collapsed = false }: SidebarLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));
  const IconComponent = (Icons as any)[iconName] || Icons.Circle;

  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 flex items-center gap-2.5 ${
        isActive 
          ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100' 
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
      }`}
    >
      <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  );
}

export function Sidebar() {
  const location = useLocation();
  const userRole = useAuthStore(state => state.user?.role) || 'EMPLOYEE';
  const email = useAuthStore(state => state.user?.email);
  const logout = useAuthStore(state => state.logout);

  const favorites = useNavigationStore(state => state.favorites);
  const recents = useNavigationStore(state => state.recents);

  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Procurement: true,
    Inventory: true,
    Production: true,
    Finance: true,
    Reports: false,
    Administration: false,
    Configuration: false
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Filter routes by role authorization
  const authorizedRoutes = ERP_ROUTES.filter(route => {
    if (userRole === 'SUPER_ADMIN') return true;
    return route.roles.includes(userRole);
  });

  // Track page visits
  React.useEffect(() => {
    const activeRoute = ERP_ROUTES.find(r => r.path === location.pathname);
    if (activeRoute) {
      useNavigationStore.getState().addRecent(activeRoute.path, activeRoute.title);
    }
  }, [location.pathname]);

  // Map Favorites to RouteConfigs
  const favoriteRoutes = favorites
    .map(path => ERP_ROUTES.find(r => r.path === path))
    .filter(Boolean);

  // Group paths
  const configRoutes = [
    "/workflows/builder",
    "/sla/builder",
    "/sla/escalations",
    "/rbac/matrix",
    "/integrations",
    "/data-migration/wizard",
    "/data-migration/history",
    "/manufacturing/routings"
  ];

  const getGroupedRoutes = (groupName: string) => {
    return authorizedRoutes.filter(route => {
      // Exclude configuration setup items from primary groups
      if (configRoutes.includes(route.path)) return false;

      switch (groupName) {
        case 'Procurement':
          return ['Purchasing & RFQ', 'Accounts Payable'].includes(route.module) && 
                 !['/finance/liabilities', '/finance/ledger', '/finance/tally', '/finance/tally/mapping', '/finance/tally/reconciliation'].includes(route.path);
        case 'Inventory':
          return ['Warehouse & Receipts'].includes(route.module);
        case 'Production':
          return ['Manufacturing'].includes(route.module);
        case 'Finance':
          return ['General Ledger Core', 'Finance Reporting'].includes(route.module) ||
                 ['/finance/liabilities', '/finance/ledger', '/finance/tally', '/finance/tally/mapping', '/finance/tally/reconciliation'].includes(route.path);
        case 'Reports':
          return route.path.includes('/reports') || route.path.includes('/analytics') || route.title.toLowerCase().includes('report');
        case 'Administration':
          return ['Administration', 'Observability'].includes(route.module) && !configRoutes.includes(route.path);
        default:
          return false;
      }
    });
  };

  const configurationRoutes = authorizedRoutes.filter(route => configRoutes.includes(route.path));

  const renderGroup = (groupName: string, label: string, icon: React.ReactNode) => {
    const routes = getGroupedRoutes(groupName);
    if (routes.length === 0) return null;
    const isOpen = openGroups[groupName];

    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleGroup(groupName)}
          className="w-full flex items-center justify-between px-3 py-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100/50 rounded-lg transition-all text-xs font-bold uppercase tracking-wider"
        >
          <div className="flex items-center gap-2">
            {icon}
            {!collapsed && <span>{label}</span>}
          </div>
          {!collapsed && (isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
        </button>
        {isOpen && !collapsed && (
          <div className="pl-3 border-l border-slate-200/80 ml-4 space-y-0.5 animate-slide-down">
            {routes.map(r => (
              <SidebarLink key={r.path} to={r.path} iconName={r.icon}>
                {r.title}
              </SidebarLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={`bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 h-full transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
        {!collapsed && (
          <div>
            <h2 className="text-xs font-black tracking-tight text-slate-900">ERP ENTERPRISE</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[170px]">{email}</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 transition-colors mx-auto"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Nav Content */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Core Nav Link: Home */}
        <SidebarLink to="/" iconName="Home" collapsed={collapsed}>Home</SidebarLink>

        {/* Favorites section */}
        {favoriteRoutes.length > 0 && !collapsed && (
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-500 fill-current" /> Favorites</div>
            <div className="space-y-0.5">
              {favoriteRoutes.map(r => r && (
                <SidebarLink key={r.path} to={r.path} iconName={r.icon}>
                  {r.title}
                </SidebarLink>
              ))}
            </div>
          </div>
        )}

        {/* Groups */}
        {renderGroup('Procurement', 'Procurement', <Icons.ShoppingBag className="w-4 h-4" />)}
        {renderGroup('Inventory', 'Inventory', <Icons.Box className="w-4 h-4" />)}
        {renderGroup('Production', 'Production', <Icons.Cpu className="w-4 h-4" />)}
        {renderGroup('Finance', 'Finance', <Icons.CreditCard className="w-4 h-4" />)}
        {renderGroup('Reports', 'Reports', <Icons.FileBarChart className="w-4 h-4" />)}
        {renderGroup('Administration', 'Administration', <Icons.Settings className="w-4 h-4" />)}

        {/* Administration -> Configuration Submenu */}
        {configurationRoutes.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => toggleGroup('Configuration')}
              className="w-full flex items-center justify-between px-3 py-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100/50 rounded-lg transition-all text-xs font-bold uppercase tracking-wider"
            >
              <div className="flex items-center gap-2">
                <Icons.Sliders className="w-4 h-4" />
                {!collapsed && <span>Configuration</span>}
              </div>
              {!collapsed && (openGroups.Configuration ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
            </button>
            {openGroups.Configuration && !collapsed && (
              <div className="pl-3 border-l border-slate-200/80 ml-4 space-y-0.5 animate-slide-down">
                {configurationRoutes.map(r => (
                  <SidebarLink key={r.path} to={r.path} iconName={r.icon}>
                    {r.title}
                  </SidebarLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recents Section */}
        {recents.length > 0 && !collapsed && (
          <div className="space-y-1 pt-2 border-t border-slate-200/80">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 flex items-center gap-1.5"><Clock className="w-3 h-3 text-slate-400" /> Recent Visits</div>
            <div className="space-y-0.5">
              {recents.slice(0, 5).map(r => (
                <Link
                  key={r.path}
                  to={r.path}
                  className="px-3 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-2 truncate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span className="truncate">{r.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Logout session button */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100/80 text-slate-700 text-xs font-bold rounded-lg transition-all shadow-sm"
        >
          <Icons.LogOut className="w-3.5 h-3.5 text-slate-400" />
          {!collapsed && <span>Logout Session</span>}
        </button>
      </div>
    </aside>
  );
}
