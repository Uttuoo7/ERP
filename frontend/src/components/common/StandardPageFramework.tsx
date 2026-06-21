import React, { useState } from 'react';
import { Star, Filter, X } from 'lucide-react';
import { useNavigationStore } from '../../store/navigationStore';
import { useLocation } from 'react-router-dom';

interface Breadcrumb {
  label: string;
  path?: string;
}

interface StandardPageFrameworkProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  
  // Page actions (buttons at the top right)
  actions?: React.ReactNode;
  
  // Filters or search triggers (in the Action Bar area)
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filterContent?: React.ReactNode; // Advanced collapsible filters
  
  // Bulk actions on table selection
  selectedCount?: number;
  bulkActions?: React.ReactNode;
  
  // Main data content
  children: React.ReactNode;
  
  // Side details drawer content
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
  drawerTitle?: string;
  drawerContent?: React.ReactNode;
}

export const StandardPageFramework: React.FC<StandardPageFrameworkProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  searchPlaceholder = "Search records...",
  searchValue = "",
  onSearchChange,
  filterContent,
  selectedCount = 0,
  bulkActions,
  children,
  drawerOpen = false,
  onDrawerClose,
  drawerTitle = "Details",
  drawerContent
}) => {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const isFavorite = useNavigationStore(state => state.favorites.includes(currentPath));
  const toggleFavorite = useNavigationStore(state => state.toggleFavorite);

  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden w-full">
      {/* 1. Page Header */}
      <div className="px-8 pt-6 pb-4 bg-white border-b border-slate-200">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex mb-2 text-[10px] font-bold text-slate-400 space-x-1.5 items-center uppercase tracking-wider">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span>/</span>}
                {crumb.path ? (
                  <a href={crumb.path} className="hover:text-slate-600 transition-colors">{crumb.label}</a>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
              <button 
                onClick={() => toggleFavorite(currentPath)}
                className={`p-1 rounded-md hover:bg-slate-100 transition-colors ${
                  isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'
                }`}
                title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Star className="w-4 h-4 fill-current" />
              </button>
            </div>
            {description && (
              <p className="text-xs font-semibold text-slate-500 mt-1">{description}</p>
            )}
          </div>
          
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* 2. Action Bar & Filter Controls */}
      <div className="px-8 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          {onSearchChange && (
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              <span className="absolute left-2.5 top-2.5 text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          )}

          {filterContent && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${
                showFilters 
                  ? 'bg-slate-100 border-slate-300 text-slate-900' 
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Filter className="w-3.5 h-3.5" /> Filters
            </button>
          )}
        </div>

        {/* 4. Bulk Actions */}
        {selectedCount > 0 && bulkActions && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1 text-xs font-bold text-blue-700 animate-fade-in">
            <span>{selectedCount} selected</span>
            <div className="h-4 w-[1px] bg-blue-200" />
            <div className="flex items-center gap-1.5">{bulkActions}</div>
          </div>
        )}
      </div>

      {/* Collapsible Filters Container */}
      {filterContent && showFilters && (
        <div className="px-8 py-4 bg-white border-b border-slate-200 shadow-inner flex flex-wrap gap-4 animate-slide-down">
          {filterContent}
        </div>
      )}

      {/* 3. Main Data Content Area (Grid/Table) */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden min-h-[400px]">
          {children}
        </div>
      </div>

      {/* 5. Details Drawer (Sliding Side Panel) */}
      {drawerContent && (
        <div 
          className={`absolute top-0 right-0 h-full w-[460px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-all duration-300 transform ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">{drawerTitle}</h3>
            <button 
              onClick={onDrawerClose}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {drawerContent}
          </div>
        </div>
      )}
    </div>
  );
};
