import React from 'react';
import { Receipt, Plus } from 'lucide-react';

export function ExpenseClaims() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Receipt className="w-8 h-8 text-indigo-600" />
            Expense Claims
          </h1>
          <p className="text-slate-500 mt-1">Submit receipts and track reimbursement status.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Claim
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[500px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No Expense Claims</h3>
          <p className="text-sm mt-1">Submit your first expense claim to get reimbursed.</p>
        </div>
      </div>
    </div>
  );
}
