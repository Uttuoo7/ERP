import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from "../../store/authStore";
import { ERP_ROUTES } from '../../routes/routes.config';
import * as Icons from 'lucide-react';

function SidebarLink({ to, iconName, children }: { to: string; iconName: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
  
  const IconComponent = (Icons as any)[iconName] || Icons.Circle;

  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 flex items-center gap-2 ${
        isActive 
          ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100' 
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
      }`}
    >
      <IconComponent className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
      <span className="truncate">{children}</span>
    </Link>
  );
}

export function Sidebar() {
  const userRole = useAuthStore(state => state.user?.role) || 'EMPLOYEE';
  const email = useAuthStore(state => state.user?.email);
  const logout = useAuthStore(state => state.logout);
  
  // Filter routes by role authorization
  const authorizedRoutes = ERP_ROUTES.filter(route => {
    if (userRole === 'SUPER_ADMIN') return true;
    return route.roles.includes(userRole);
  });

  // Maintain the natural order of modules as they appear in the registry
  const modules: { name: string; routes: typeof ERP_ROUTES }[] = [];
  authorizedRoutes.forEach(route => {
    let mod = modules.find(m => m.name === route.module);
    if (!mod) {
      mod = { name: route.module, routes: [] };
      modules.push(mod);
    }
    mod.routes.push(route);
  });

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 h-full">
      <div className="h-16 px-6 flex flex-col justify-center border-b border-slate-200 shrink-0">
        <h2 className="text-lg font-black tracking-tight text-slate-900">P2P ERP</h2>
        <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase truncate">
          {email}
        </p>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {modules.map((moduleGroup) => (
          <div key={moduleGroup.name}>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2">
              {moduleGroup.name}
            </div>
            <div className="space-y-0.5">
              {moduleGroup.routes.map(route => (
                <SidebarLink key={route.path} to={route.path} iconName={route.icon}>
                  {route.title}
                </SidebarLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <button
          onClick={logout}
          className="w-full px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          Logout Session
        </button>
      </div>
    </aside>
  );
}
