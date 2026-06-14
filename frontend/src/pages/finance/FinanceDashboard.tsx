import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Landmark, ArrowRightLeft, FileSpreadsheet, FolderTree, RefreshCw, TrendingUp, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getFinanceDashboardSummary } from '../../api';

interface DashboardSummary {
  cash_position: number;
  grni_balance: number;
  ap_balance: number;
  outstanding_liabilities: number;
}

const FinanceDashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await getFinanceDashboardSummary();
      setSummary(res.data);
    } catch (err) {
      toast.error('Failed to load financial dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" /> Finance Core Cockpit
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Real-time General Ledger balances, cash positions, and accrued liabilities breakdown</p>
        </div>

        <button
          onClick={fetchSummary}
          className="p-2 border border-slate-200 bg-white rounded-xl shadow-sm text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1 text-xs font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync GL Balances
        </button>
      </div>

      {loading && !summary ? (
        <div className="text-center py-16 text-slate-400 text-xs font-semibold">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          Calculating dashboard metrics from general ledger...
        </div>
      ) : !summary ? (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          Failed to load metrics. Ensure database table seeding is fully initialized.
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Cash Position */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Bank / Cash Position</span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <Landmark className="w-4 h-4" />
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">
                  ₹{summary.cash_position.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-slate-400 font-bold block mt-1">Total liquid bank reserves</span>
              </div>
            </div>

            {/* AP Control */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">AP Control Balance</span>
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                  <TrendingUp className="w-4 h-4 rotate-180" />
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">
                  ₹{summary.ap_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-slate-400 font-bold block mt-1">Confirmed trade payables (Creditors)</span>
              </div>
            </div>

            {/* GRNI Accruals */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">GRNI Accrual Balance</span>
                <span className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                  <ArrowRightLeft className="w-4 h-4" />
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">
                  ₹{summary.grni_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-slate-400 font-bold block mt-1">Unbilled receipt accruals liability</span>
              </div>
            </div>

            {/* Outstanding Liabilities */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Outstanding Liabilities</span>
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">
                  ₹{summary.outstanding_liabilities.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-slate-400 font-bold block mt-1">Aging payables due for release</span>
              </div>
            </div>

          </div>

          {/* Quick Workspaces Navigation */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Financial Operations Workspaces</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Quick access to ledger configs, report books, and transaction journals</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Chart of Accounts Workspace */}
              <Link 
                to="/finance/coa" 
                className="p-5 rounded-2xl border border-slate-150 hover:bg-slate-50/50 transition-all flex justify-between items-center group"
              >
                <div className="flex gap-3 items-center">
                  <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                    <FolderTree className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Chart of Accounts</h4>
                    <span className="text-[10px] text-slate-400 font-semibold">Manage GL codes & periods lock</span>
                  </div>
                </div>
                <ArrowUpRight className="w-4.5 h-4.5 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>

              {/* Manual Journals Workspace */}
              <Link 
                to="/finance/journals" 
                className="p-5 rounded-2xl border border-slate-150 hover:bg-slate-50/50 transition-all flex justify-between items-center group"
              >
                <div className="flex gap-3 items-center">
                  <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                    <BookOpen className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Manual Journals</h4>
                    <span className="text-[10px] text-slate-400 font-semibold">Compose entries & reverse vouchers</span>
                  </div>
                </div>
                <ArrowUpRight className="w-4.5 h-4.5 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>

              {/* Reports Workspace */}
              <Link 
                to="/finance/reports" 
                className="p-5 rounded-2xl border border-slate-150 hover:bg-slate-50/50 transition-all flex justify-between items-center group"
              >
                <div className="flex gap-3 items-center">
                  <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                    <FileSpreadsheet className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Financial Reports</h4>
                    <span className="text-[10px] text-slate-400 font-semibold">Verify trial balance & running ledger</span>
                  </div>
                </div>
                <ArrowUpRight className="w-4.5 h-4.5 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>

            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;
