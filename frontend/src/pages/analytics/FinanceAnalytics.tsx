import React from 'react';
import { DollarSign } from 'lucide-react';

export function FinanceAnalytics() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-indigo-600" />
            Financial Analytics
          </h1>
          <p className="text-slate-500 mt-1">Deep dive into profitability, cash flow, and AP/AR aging.</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[500px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">Finance Data Warehouse</h3>
          <p className="text-sm mt-1">Loading aggregated financial snapshots...</p>
        </div>
      </div>
    </div>
  );
}
