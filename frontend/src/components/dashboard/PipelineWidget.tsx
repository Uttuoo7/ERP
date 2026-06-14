import React from 'react';
import { FileText, ClipboardList, SendToBack, Truck, FileSignature, Landmark } from 'lucide-react';

export interface PipelineStage {
  id: string;
  label: string;
  count: number;
  icon: React.ElementType;
}

export const PipelineWidget: React.FC<{ stages: PipelineStage[] }> = ({ stages }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm w-full">
    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest mb-6">Procurement Pipeline Volume</h3>
    <div className="flex items-stretch gap-2 overflow-x-auto pb-4">
      {stages.map((stage, idx) => (
        <React.Fragment key={stage.id}>
          <div className="flex-1 min-w-[120px] bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:bg-indigo-50 hover:border-indigo-100 transition-colors cursor-pointer">
            <stage.icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors" />
            <div className="text-2xl font-black text-slate-900 mb-1">{stage.count}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stage.label}</div>
          </div>
          {idx < stages.length - 1 && (
            <div className="flex items-center justify-center w-6 shrink-0 text-slate-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);
