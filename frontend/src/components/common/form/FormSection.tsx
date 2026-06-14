import React, { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, icon, children, className = "" }) => {
  return (
    <div className={`bg-white rounded-xl border border-erp-border shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-3.5 border-b border-erp-border bg-slate-50/50 flex items-center gap-2">
        {icon && <span className="text-slate-400">{icon}</span>}
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
};
