import React, { useState, useEffect } from 'react';
import { Plus, Settings, DollarSign, FolderTree, ArrowRight } from 'lucide-react';
import api from "../../api";

export function BudgetAllocationManager() {
  const [budgets, setBudgets] = useState<any[]>([]);

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    try {
      const response = await api.get('/budgets/');
      setBudgets(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <FolderTree className="w-8 h-8 text-indigo-600" />
            Budget Allocation Manager
          </h1>
          <p className="text-slate-500 mt-1 text-lg">Define and distribute enterprise budgets across dimensions.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Create Budget
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-700">Active Financial Budgets</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {budgets.length > 0 ? budgets.map((b) => (
            <div key={b.id} className="p-6 hover:bg-slate-50 flex items-center justify-between group">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{b.name}</h3>
                <p className="text-sm text-slate-500 mt-1">Fiscal Year: <span className="font-semibold text-slate-700">{b.fiscal_year}</span> • Status: <span className="font-semibold text-emerald-600">{b.status}</span></p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-slate-500 font-medium">Total Pool</p>
                  <p className="text-xl font-bold text-slate-800">${parseFloat(b.total_budget).toLocaleString(undefined, {minimumFractionDigits:2})}</p>
                </div>
                <button className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )) : (
            <div className="p-12 text-center text-slate-500">
              No budgets found. Create your first budget to begin governance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
