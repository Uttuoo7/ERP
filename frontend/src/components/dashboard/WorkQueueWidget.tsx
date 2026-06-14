import React from 'react';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export interface WorkItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'approval' | 'sla_breach' | 'escalation' | 'assigned';
  urgency: 'high' | 'medium' | 'low';
}

export const WorkQueueWidget: React.FC<{ items: WorkItem[] }> = ({ items }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col">
    <div className="flex justify-between items-center mb-5">
      <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">My Work Queue</h3>
      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{items.length} Pending</span>
    </div>
    
    <div className="space-y-3 flex-1 overflow-y-auto pr-2">
      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-semibold">You're all caught up!</p>
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className={`mt-0.5 ${item.urgency === 'high' ? 'text-rose-500' : item.urgency === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>
              {item.type === 'sla_breach' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.title}</div>
              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{item.subtitle}</div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
