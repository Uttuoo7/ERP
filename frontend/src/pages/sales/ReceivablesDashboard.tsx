import React from 'react';
import { DollarSign, FileText, AlertTriangle, CheckCircle, TrendingDown, Users } from 'lucide-react';

export function ReceivablesDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-indigo-600" />
            Accounts Receivable & Revenue
          </h1>
          <p className="text-slate-500 mt-1">Track customer payments, aging receivables, and ledger balances.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Total Receivables</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">$0.00</div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">0-30 Days</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">$0.00</div>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl shadow-sm p-5 bg-rose-50 border-l-4 border-l-rose-500">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-rose-800">90+ Days Overdue</h3>
          </div>
          <div className="text-2xl font-black text-rose-900">$0.00</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[400px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No open AR invoices</h3>
          <p className="text-sm mt-1">All customer invoices have been fully paid.</p>
        </div>
      </div>
    </div>
  );
}
