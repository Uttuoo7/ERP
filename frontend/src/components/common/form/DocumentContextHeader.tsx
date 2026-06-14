import React, { ReactNode } from 'react';

export interface ContextDetail {
  label: string;
  value: ReactNode;
}

interface DocumentContextHeaderProps {
  details: ContextDetail[];
}

export const DocumentContextHeader: React.FC<DocumentContextHeaderProps> = ({ details }) => {
  return (
    <div className="bg-white border-b border-erp-border px-4 md:px-6 lg:px-8 py-3.5 z-20">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-y-3 gap-x-8 md:gap-x-12">
        {details.map((d, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{d.label}</span>
            <span className="text-sm font-semibold text-slate-900">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
