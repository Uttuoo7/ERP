import React from 'react';
import { Users } from 'lucide-react';

export function HRAnalytics() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            HR Analytics
          </h1>
          <p className="text-slate-500 mt-1">Workforce analytics, attendance trends, and productivity.</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[500px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">HR Data Warehouse</h3>
          <p className="text-sm mt-1">Loading aggregated HR snapshots...</p>
        </div>
      </div>
    </div>
  );
}
