import React, { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface FormStickyBarProps {
  title: string;
  onBack?: () => void;
  actions: ReactNode;
}

export const FormStickyBar: React.FC<FormStickyBarProps> = ({ title, onBack, actions }) => {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-erp-border shadow-sm px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors border border-transparent hover:border-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {actions}
      </div>
    </div>
  );
};
