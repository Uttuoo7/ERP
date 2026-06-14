import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, breadcrumbs, actions, secondaryActions, recentItems }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-sm text-erp-secondary mb-2">
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={idx}>
                  {bc.path ? (
                    <Link to={bc.path} className="hover:text-erp-primary transition-colors">{bc.label}</Link>
                  ) : (
                    <span className="text-slate-900 font-medium">{bc.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4 mx-1" />}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-erp-secondary mt-1 max-w-2xl">{description}</p>
          )}
        </div>
        {(actions || secondaryActions || recentItems) && (
          <div className="flex flex-wrap items-center gap-3">
            {recentItems}
            {secondaryActions && <div className="flex items-center gap-2">{secondaryActions}</div>}
            {actions && <div className="flex items-center gap-2 pl-2 border-l border-erp-border">{actions}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
