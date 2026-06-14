import React from 'react';
import { Check } from 'lucide-react';

export interface WorkflowStage {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
  timestamp?: string;
}

export const WorkflowTimeline: React.FC<{ stages: WorkflowStage[] }> = ({ stages }) => {
  return (
    <div className="bg-white border-b border-erp-border px-4 md:px-6 lg:px-8 pt-6 pb-12 z-10 shadow-sm relative">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-8">
        <div className="flex items-center w-full">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            const isCompleted = stage.status === 'completed';
            const isCurrent = stage.status === 'current';
            const isRejected = stage.status === 'rejected';

            let bgColor = 'bg-slate-100';
            let textColor = 'text-slate-400';
            let borderColor = 'border-slate-200';

            if (isCompleted) {
              bgColor = 'bg-emerald-500';
              textColor = 'text-white';
              borderColor = 'border-emerald-500';
            } else if (isCurrent) {
              bgColor = 'bg-blue-600';
              textColor = 'text-white';
              borderColor = 'border-blue-600';
            } else if (isRejected) {
              bgColor = 'bg-rose-500';
              textColor = 'text-white';
              borderColor = 'border-rose-500';
            }

            return (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-colors ${bgColor} ${borderColor} ${textColor}`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : (idx + 1)}
                  </div>
                  <div className="absolute top-10 flex flex-col items-center w-32 text-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
                      {stage.label}
                    </span>
                    {stage.timestamp && (
                      <span className="text-[9px] text-slate-400 font-medium mt-0.5">{stage.timestamp}</span>
                    )}
                  </div>
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
