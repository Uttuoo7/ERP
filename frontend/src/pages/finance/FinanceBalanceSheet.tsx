import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, ArrowRightLeft, Calendar, FileText, CheckCircle2, AlertTriangle, ChevronRight, RefreshCw, BarChart3, TrendingUp, TrendingDown 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getBalanceSheet } from '../../api';

interface BalanceSheetItem {
  id: string;
  code: string;
  name: string;
  balance: number;
  prev_balance: number;
  variance: number;
}

interface BalanceSheetReport {
  as_of_date: string;
  comparison_date: string;
  assets: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  equity: BalanceSheetItem[];
  total_assets: number;
  prev_total_assets: number;
  total_liabilities: number;
  prev_total_liabilities: number;
  total_equity: number;
  prev_total_equity: number;
  assets_equals_liabilities_plus_equity: boolean;
  difference: number;
}

const FinanceBalanceSheet: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  
  // Date filter states (YYYY-MM-DD)
  const [asOfDate, setAsOfDate] = useState<string>('');
  const [comparisonDate, setComparisonDate] = useState<string>('');

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (asOfDate) params.as_of_date = asOfDate;
      if (comparisonDate) params.comparison_date = comparisonDate;

      const res = await getBalanceSheet(params);
      setReport(res.data);
    } catch (err) {
      toast.error('Failed to load Balance Sheet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  const handleDrillDown = (accountId: string) => {
    navigate(`/finance/reports?tab=account_ledger&accountId=${accountId}`);
  };

  const renderSectionRows = (items: BalanceSheetItem[]) => {
    if (items.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="px-6 py-4 text-center text-slate-400 text-xs italic">
            No accounts in this category
          </td>
        </tr>
      );
    }

    return items.map((item) => {
      const isPositiveVariance = item.variance >= 0;
      return (
        <tr 
          key={item.id} 
          onClick={() => handleDrillDown(item.id)}
          className="hover:bg-indigo-50/20 cursor-pointer group transition-colors"
        >
          <td className="px-6 py-3 font-mono font-bold text-slate-900 text-[13px] group-hover:text-indigo-600">
            {item.code}
          </td>
          <td className="px-6 py-3 text-slate-800 font-semibold group-hover:text-indigo-600 flex items-center justify-between">
            {item.name}
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity ml-2" />
          </td>
          <td className="px-6 py-3 text-right text-slate-900 font-bold">
            ₹{item.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td className="px-6 py-3 text-right text-slate-500 font-semibold">
            ₹{item.prev_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td className={`px-6 py-3 text-right font-black flex items-center justify-end gap-1 ${
            isPositiveVariance ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {isPositiveVariance ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>
              ₹{Math.abs(item.variance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" /> Balance Sheet Statement
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Dynamic asset allocation, recognized liabilities, and owner equity balances with prior period comparisons.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">As Of:</span>
            <input 
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="p-1 border border-slate-250 rounded outline-none focus:border-indigo-500 text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="text-slate-500">Compare To:</span>
            <input 
              type="date"
              value={comparisonDate}
              onChange={(e) => setComparisonDate(e.target.value)}
              className="p-1 border border-slate-250 rounded outline-none focus:border-indigo-500 text-slate-800"
            />
          </div>
          <button 
            onClick={fetchBalanceSheet}
            disabled={loading}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition-all disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Apply Filters'}
          </button>
        </div>
      </div>

      {loading && !report ? (
        <div className="text-center py-16 text-slate-400 text-xs font-semibold">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
          Calculating Balance Sheet Statement...
        </div>
      ) : !report ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
          <AlertTriangle className="w-12 h-12 text-slate-350 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Failed to Load</h3>
          <p className="text-xs text-slate-400 mt-1">Please try refreshing the page or checking backend connection.</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Parity Status Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold shadow-sm ${
            report.assets_equals_liabilities_plus_equity 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
              : 'bg-rose-50 text-rose-700 border-rose-150 animate-pulse'
          }`}>
            <div className="flex gap-4">
              <div>
                <span className="text-[9px] uppercase tracking-widest block opacity-70">Total Assets</span>
                <span className="text-sm font-black">₹{report.total_assets.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-l border-current/25 pl-4">
                <span className="text-[9px] uppercase tracking-widest block opacity-70">Total Liabilities + Equity</span>
                <span className="text-sm font-black">
                  ₹{(report.total_liabilities + report.total_equity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {report.assets_equals_liabilities_plus_equity ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>ACCOUNTING EQUATION BALANCED (ASSETS = LIABILITIES + EQUITY)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>TRIAL BALANCE OUT OF SYNC (DISCREPANCY: ₹{report.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
                </>
              )}
            </div>
          </div>

          {/* Statement Grid */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4 w-1/6">Account Code</th>
                    <th className="px-6 py-4 w-2/5">GL Account Description</th>
                    <th className="px-6 py-4 text-right">Current Balance (₹)</th>
                    <th className="px-6 py-4 text-right">Previous Balance (₹)</th>
                    <th className="px-6 py-4 text-right">Variance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  
                  {/* ASSETS SECTION */}
                  <tr className="bg-indigo-50/10 font-black text-slate-900 border-t border-slate-200">
                    <td colSpan={5} className="px-6 py-3 text-[11px] uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> ASSETS (Debit Balances)
                    </td>
                  </tr>
                  {renderSectionRows(report.assets)}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs border-b border-slate-200">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">TOTAL ASSETS</td>
                    <td className="px-6 py-4 text-right text-indigo-700">
                      ₹{report.total_assets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{report.prev_total_assets.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-700">
                      ₹{(report.total_assets - report.prev_total_assets).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* LIABILITIES SECTION */}
                  <tr className="bg-amber-50/10 font-black text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={5} className="px-6 py-3 text-[11px] uppercase tracking-wider text-amber-700 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> LIABILITIES (Credit Balances)
                    </td>
                  </tr>
                  {renderSectionRows(report.liabilities)}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs border-b border-slate-200">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">TOTAL LIABILITIES</td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{report.total_liabilities.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{report.prev_total_liabilities.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{(report.total_liabilities - report.prev_total_liabilities).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* EQUITY SECTION */}
                  <tr className="bg-emerald-50/10 font-black text-slate-900 border-t-2 border-slate-200">
                    <td colSpan={5} className="px-6 py-3 text-[11px] uppercase tracking-wider text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> OWNER EQUITY (Credit Balances)
                    </td>
                  </tr>
                  {renderSectionRows(report.equity)}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs border-b border-slate-200">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">TOTAL OWNER EQUITY</td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{report.total_equity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{report.prev_total_equity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{(report.total_equity - report.prev_total_equity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* EQUATION PARITY ROW */}
                  <tr className="bg-slate-100 font-extrabold text-slate-900 text-xs border-t border-slate-300">
                    <td colSpan={2} className="px-6 py-5">TOTAL LIABILITIES & EQUITY PARITY</td>
                    <td className="px-6 py-5 text-right text-emerald-700 text-sm">
                      ₹{(report.total_liabilities + report.total_equity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 text-right text-slate-500">
                      ₹{(report.prev_total_liabilities + report.prev_total_equity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 text-right text-emerald-700">
                      ₹{((report.total_liabilities + report.total_equity) - (report.prev_total_liabilities + report.prev_total_equity)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default FinanceBalanceSheet;
