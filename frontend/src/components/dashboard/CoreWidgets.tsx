import React from 'react';

export const KPIWidget: React.FC<{ title: string; value: string | number; subtitle?: string; icon: React.ElementType; trend?: { value: number; label: string; positive: boolean } }> = ({ title, value, subtitle, icon: Icon, trend }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-full transition-shadow hover:shadow-md">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
      <div className="p-2 bg-slate-50 rounded-lg"><Icon className="w-4 h-4 text-slate-600" /></div>
    </div>
    <div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      {subtitle && <div className="text-[11px] font-semibold text-slate-400 mt-1">{subtitle}</div>}
      {trend && (
        <div className={`text-[11px] font-bold mt-2 flex items-center gap-1 ${trend.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% <span className="text-slate-400 ml-1">{trend.label}</span>
        </div>
      )}
    </div>
  </div>
);

export const ActionTile: React.FC<{ title: string; subtitle: string; icon: React.ElementType; onClick: () => void; color?: string }> = ({ title, subtitle, icon: Icon, onClick, color = 'blue' }) => (
  <button onClick={onClick} className={`text-left p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-${color}-200 bg-white group flex items-start gap-4 w-full h-full`}>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600 group-hover:bg-${color}-600 group-hover:text-white transition-colors`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  </button>
);
