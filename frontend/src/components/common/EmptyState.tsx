import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center p-6 gap-3">
      <div className="text-slate-300 w-12 h-12 flex items-center justify-center mb-1">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
