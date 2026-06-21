import React from 'react';

export interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  recentItems?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  description, 
  actions, 
  secondaryActions, 
  recentItems 
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-slate-200 bg-white rounded-2xl shadow-sm mb-6 select-none font-sans">
      <div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">{title}</h2>
        {description && (
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{description}</p>
        )}
      </div>
      {(actions || secondaryActions || recentItems) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {recentItems}
          {secondaryActions}
          {actions}
        </div>
      )}
    </div>
  );
};
