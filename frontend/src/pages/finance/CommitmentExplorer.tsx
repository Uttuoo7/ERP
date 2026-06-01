import React, { useState, useEffect } from 'react';
import { Layers, Search, Filter, ChevronRight, DollarSign } from 'lucide-react';
import api from "../../api";

export function CommitmentExplorer() {
  const [exposure, setExposure] = useState<any>(null);

  useEffect(() => {
    fetchExposure();
  }, []);

  const fetchExposure = async () => {
    try {
      const response = await api.get('/budgets/intelligence/commitment-exposure');
      setExposure(response.data.exposure);
    } catch (e) {
      console.error(e);
    }
  };

  const formatCurrency = (val: number) => {
    return val ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Layers className="w-8 h-8 text-indigo-600" />
            Commitment Explorer
          </h1>
          <p className="text-slate-500 mt-1 text-lg">Drill down into planned, committed, and actual liabilities.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
            <input 
              type="text" 
              placeholder="Search by Cost Center, Project, or Department..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                <th className="p-4 pl-6">Dimension</th>
                <th className="p-4 text-right">Planned (PR)</th>
                <th className="p-4 text-right">Committed (PO)</th>
                <th className="p-4 text-right">Accrued (GRN)</th>
                <th className="p-4 text-right">Actual (INV)</th>
                <th className="p-4 text-right">Paid (PMT)</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exposure?.department_exposure ? Object.keys(exposure.department_exposure).map((deptId) => (
                <tr key={deptId} className="hover:bg-slate-50 group cursor-pointer transition-colors">
                  <td className="p-4 pl-6 font-medium text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    {deptId === "Global" ? "Global Pool" : `Department: ${deptId.substring(0,8)}`}
                  </td>
                  <td className="p-4 text-right text-slate-600">{formatCurrency(exposure.breakdown.planned)}</td>
                  <td className="p-4 text-right text-indigo-600 font-medium">{formatCurrency(exposure.breakdown.committed)}</td>
                  <td className="p-4 text-right text-amber-600 font-medium">{formatCurrency(exposure.breakdown.accrued)}</td>
                  <td className="p-4 text-right text-emerald-600 font-medium">{formatCurrency(exposure.breakdown.actual)}</td>
                  <td className="p-4 text-right text-slate-500">{formatCurrency(exposure.breakdown.paid)}</td>
                  <td className="p-4 text-center">
                    <button className="text-slate-400 group-hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-full transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    No active commitments found in the ledger.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
