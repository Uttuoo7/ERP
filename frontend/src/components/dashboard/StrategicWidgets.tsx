import React from 'react';
import { Landmark, TrendingDown, Activity, AlertCircle } from 'lucide-react';

export const FinanceHealthWidget: React.FC<{ outstanding: number; dueThisWeek: number; blockedPayments: number }> = ({ outstanding, dueThisWeek, blockedPayments }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Landmark className="w-4 h-4 text-slate-400" /> Finance Health</h3>
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase">AP Outstanding</div>
        <div className="text-xl font-black text-slate-900">₹{outstanding.toLocaleString('en-IN')}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Due This Week</div>
          <div className="text-sm font-bold text-amber-600">₹{dueThisWeek.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Blocked Payments</div>
          <div className={`text-sm font-bold ${blockedPayments > 0 ? 'text-rose-600 flex items-center gap-1' : 'text-slate-600'}`}>
            {blockedPayments > 0 && <AlertCircle className="w-3.5 h-3.5" />} {blockedPayments} Invoices
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const SpendWidget: React.FC = () => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative">
    <div className="absolute top-3 right-3 bg-indigo-50 text-indigo-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Beta Analytics</div>
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Spend Overview</h3>
    <div className="h-32 flex items-end gap-2 mb-2">
      {/* Mock Bar Chart */}
      {[40, 70, 45, 90, 65, 80].map((h, i) => (
        <div key={i} className="flex-1 bg-indigo-100 rounded-t-sm hover:bg-indigo-300 transition-colors relative group" style={{ height: `${h}%` }}>
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">₹{h}k</div>
        </div>
      ))}
    </div>
    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
      <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span>
    </div>
  </div>
);

export const VendorPerformanceWidget: React.FC = () => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative">
    <div className="absolute top-3 right-3 bg-amber-50 text-amber-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Preview Data</div>
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Vendor Performance</h3>
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-[11px] font-bold mb-1">
          <span className="text-slate-600">On-Time Delivery</span>
          <span className="text-emerald-600">94.2%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '94.2%' }}></div></div>
      </div>
      <div>
        <div className="flex justify-between text-[11px] font-bold mb-1">
          <span className="text-slate-600">Rejection Rate</span>
          <span className="text-rose-600">2.8%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-rose-500 h-1.5 rounded-full" style={{ width: '2.8%' }}></div></div>
      </div>
      <div>
        <div className="flex justify-between text-[11px] font-bold mb-1">
          <span className="text-slate-600">Avg Lead Time</span>
          <span className="text-indigo-600">14 Days</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '60%' }}></div></div>
      </div>
    </div>
  </div>
);
