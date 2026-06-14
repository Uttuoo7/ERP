import React from 'react';
import { Activity, User } from 'lucide-react';
import { FormSection } from './FormSection';

export interface AuditRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details?: string;
}

export const RecentActivityFeed: React.FC<{ activities: AuditRecord[] }> = ({ activities }) => {
  return (
    <FormSection title="Audit Trail" icon={<Activity className="w-4 h-4" />}>
      <div className="space-y-4">
        {activities.length > 0 ? activities.map((act, idx) => (
          <div key={act.id} className="flex gap-3 relative">
            {idx !== activities.length - 1 && (
              <div className="absolute top-6 bottom-[-16px] left-3 w-[2px] bg-slate-100" />
            )}
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 z-10">
              <User className="w-3 h-3 text-slate-500" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="text-xs font-bold text-slate-900">{act.user}</span>
                <span className="text-[10px] font-bold text-slate-400">{act.timestamp}</span>
              </div>
              <p className="text-xs text-slate-600">{act.action}</p>
              {act.details && <p className="text-[11px] text-slate-500 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100">{act.details}</p>}
            </div>
          </div>
        )) : (
          <p className="text-xs font-bold text-slate-400 text-center">No Audit Records Found</p>
        )}
      </div>
    </FormSection>
  );
};
