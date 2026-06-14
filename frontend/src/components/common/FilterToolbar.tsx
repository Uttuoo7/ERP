import React from 'react';
import { Search, ListFilter, LayoutGrid, LayoutList } from 'lucide-react';
import { useTableDensityStore } from '../../store/tableDensityStore';

interface FilterToolbarProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  onSearchSubmit?: () => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export function FilterToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  onSearchSubmit,
  filters,
  actions
}: FilterToolbarProps) {
  const { density, toggleDensity } = useTableDensityStore();

  return (
    <div className="p-4 border-b border-erp-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1 flex items-center gap-3">
        {onSearchChange && (
          <div className="max-w-md w-full flex items-center gap-2 bg-white border border-erp-border rounded-erp px-3 py-1.5 focus-within:ring-2 ring-erp-primary/20 shadow-sm transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit && onSearchSubmit()}
              className="w-full bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
        )}
        
        {filters && (
          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-slate-400" />
            {filters}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions && (
          <div className="flex items-center gap-2 border-r border-erp-border pr-3">
            {actions}
          </div>
        )}

        <button
          onClick={toggleDensity}
          title={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} density`}
          className="p-1.5 hover:bg-slate-200 rounded-erp text-slate-500 transition-colors bg-white border border-erp-border shadow-sm flex items-center gap-2"
        >
          {density === 'comfortable' ? (
            <LayoutList className="w-4 h-4 text-erp-primary" />
          ) : (
            <LayoutGrid className="w-4 h-4 text-erp-primary" />
          )}
        </button>
      </div>
    </div>
  );
}
