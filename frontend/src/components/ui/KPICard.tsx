import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColorClass?: string;
  subtext?: string;
  statusColorClass?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  iconColorClass = "bg-blue-600 text-white", 
  subtext, 
  statusColorClass = "text-slate-500",
  trend 
}: KPICardProps) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-xl ${iconColorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      {subtext && (
        <div className="flex items-center gap-1.5 mt-1">
          {trend === 'up' && <span className="text-emerald-500 text-[10px] font-black">↑</span>}
          {trend === 'down' && <span className="text-rose-500 text-[10px] font-black">↓</span>}
          <p className={`text-xs font-semibold ${statusColorClass}`}>{subtext}</p>
        </div>
      )}
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2 w-full">
          <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-3/4 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse shrink-0" />
      </div>
      <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse mt-1" />
    </div>
  );
}
