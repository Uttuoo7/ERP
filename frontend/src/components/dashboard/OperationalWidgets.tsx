import React from 'react';
import { ShieldAlert, AlertTriangle, PackageOpen, FileWarning, Clock } from 'lucide-react';

export const ApprovalWidget: React.FC<{ items: any[] }> = ({ items }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pending Approvals</h3>
    </div>
    <div className="space-y-3">
      {items.length === 0 ? <div className="text-xs text-slate-400">No approvals pending.</div> : items.map((item, i) => (
        <div key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{item.type}</span>
            <span className="text-xs font-semibold text-slate-700">{item.ref}</span>
          </div>
          <span className="text-[10px] font-bold text-amber-600">{item.time}</span>
        </div>
      ))}
    </div>
  </div>
);

export const RiskWidget: React.FC<{ alerts: any[] }> = ({ alerts }) => (
  <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden">
    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
    <div className="flex justify-between items-center mb-4 pl-3">
      <h3 className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Inventory Risk</h3>
    </div>
    <div className="space-y-3 pl-3">
      {alerts.map((alert, i) => (
        <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0 last:pb-0">
          <div className="flex items-start gap-2">
            {alert.type === 'shortage' ? <PackageOpen className="w-4 h-4 text-rose-500 mt-0.5" /> : <FileWarning className="w-4 h-4 text-amber-500 mt-0.5" />}
            <div>
              <div className="text-xs font-bold text-slate-800">{alert.item}</div>
              <div className="text-[10px] font-semibold text-slate-500">{alert.message}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
