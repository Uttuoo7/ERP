import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Calendar, RefreshCw, AlertTriangle, ChevronRight, BarChart2, DollarSign, PieChart 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getProfitAndLoss } from '../../api';

interface PLItem {
  id: string;
  code: string;
  name: string;
  amount: number;
  prev_amount: number;
  variance: number;
}

interface PLReport {
  start_date: string;
  end_date: string;
  comparison_start: string;
  comparison_end: string;
  revenue: PLItem[];
  cogs: PLItem[];
  expenses: PLItem[];
  total_revenue: number;
  prev_total_revenue: number;
  total_cogs: number;
  prev_total_cogs: number;
  gross_profit: number;
  prev_gross_profit: number;
  gross_profit_variance: number;
  total_expenses: number;
  prev_total_expenses: number;
  net_profit: number;
  prev_net_profit: number;
  net_profit_variance: number;
}

const ProfitAndLoss: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PLReport | null>(null);
  
  // Date filter states (YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [compStart, setCompStart] = useState<string>('');
  const [compEnd, setCompEnd] = useState<string>('');
  const [periodPreset, setPeriodPreset] = useState<'monthly' | 'quarterly' | 'custom'>('monthly');

  const fetchPLReport = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (periodPreset !== 'custom') {
        const today = new Date();
        const end = today.toISOString().split('T')[0];
        let start = '';
        
        if (periodPreset === 'monthly') {
          const past = new Date();
          past.setDate(today.getDate() - 30);
          start = past.toISOString().split('T')[0];
        } else if (periodPreset === 'quarterly') {
          const past = new Date();
          past.setDate(today.getDate() - 90);
          start = past.toISOString().split('T')[0];
        }
        
        params.start_date = start;
        params.end_date = end;
      } else {
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (compStart) params.comparison_start = compStart;
        if (compEnd) params.comparison_end = compEnd;
      }

      const res = await getProfitAndLoss(params);
      setReport(res.data);
      
      // Sync date inputs
      if (res.data) {
        setStartDate(res.data.start_date.split('T')[0]);
        setEndDate(res.data.end_date.split('T')[0]);
        setCompStart(res.data.comparison_start.split('T')[0]);
        setCompEnd(res.data.comparison_end.split('T')[0]);
      }
    } catch (err) {
      toast.error('Failed to load Profit & Loss Statement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPLReport();
  }, [periodPreset]);

  const handleDrillDown = (accountId: string) => {
    navigate(`/finance/reports?tab=account_ledger&accountId=${accountId}`);
  };

  const renderSectionRows = (items: PLItem[], isExpense: boolean = false) => {
    if (items.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="px-6 py-4 text-center text-slate-400 text-xs italic">
            No entries in this section
          </td>
        </tr>
      );
    }

    return items.map((item) => {
      // For expenses, a positive variance is bad (increase in cost), but we standardly show absolute variance
      const isPositiveVariance = item.variance >= 0;
      // In P&L, generally increase in revenue is good (+ green), increase in expense is bad (+ red)
      const varianceColor = isExpense 
        ? (isPositiveVariance ? 'text-rose-600' : 'text-emerald-600')
        : (isPositiveVariance ? 'text-emerald-600' : 'text-rose-600');

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
            ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td className="px-6 py-3 text-right text-slate-500 font-semibold">
            ₹{item.prev_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td className={`px-6 py-3 text-right font-black flex items-center justify-end gap-1 ${varianceColor}`}>
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
            <PieChart className="w-6 h-6 text-indigo-600" /> Income Statement (P&L)
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Revenues, Cost of Goods Sold (COGS), and Operating Expenses with Net Profit variance tracking.
          </p>
        </div>

        {/* Period Preset Selectors */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1 self-start text-xs font-bold shadow-xs">
          <button
            onClick={() => setPeriodPreset('monthly')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              periodPreset === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Past 30 Days
          </button>
          <button
            onClick={() => setPeriodPreset('quarterly')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              periodPreset === 'quarterly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Past 90 Days
          </button>
          <button
            onClick={() => setPeriodPreset('custom')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              periodPreset === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Custom Dates
          </button>
        </div>
      </div>

      {/* Custom Date Filters */}
      {periodPreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">From:</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-1 border border-slate-250 rounded outline-none focus:border-indigo-500 text-slate-800"
            />
            <span className="text-slate-500 ml-2">To:</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-1 border border-slate-250 rounded outline-none focus:border-indigo-500 text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
            <span className="text-slate-500">Comp. From:</span>
            <input 
              type="date"
              value={compStart}
              onChange={(e) => setCompStart(e.target.value)}
              className="p-1 border border-slate-250 rounded outline-none focus:border-indigo-500 text-slate-800"
            />
            <span className="text-slate-500 ml-2">To:</span>
            <input 
              type="date"
              value={compEnd}
              onChange={(e) => setCompEnd(e.target.value)}
              className="p-1 border border-slate-250 rounded outline-none focus:border-indigo-500 text-slate-800"
            />
          </div>
          <button 
            onClick={fetchPLReport}
            disabled={loading}
            className="ml-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition-all disabled:opacity-50"
          >
            {loading ? 'Recalculating...' : 'Refresh Statement'}
          </button>
        </div>
      )}

      {loading && !report ? (
        <div className="text-center py-16 text-slate-400 text-xs font-semibold">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
          Calculating Profit & Loss Statement...
        </div>
      ) : !report ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
          <AlertTriangle className="w-12 h-12 text-slate-350 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Failed to Load</h3>
          <p className="text-xs text-slate-400 mt-1">Please try refreshing the page or checking backend connection.</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in">
          
          {/* Performance Summary Banner */}
          <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold shadow-sm ${
            report.net_profit >= 0 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
              : 'bg-rose-50 text-rose-700 border-rose-150'
          }`}>
            <div className="flex gap-6">
              <div>
                <span className="text-[9px] uppercase tracking-widest block opacity-70">Gross Profit Margin</span>
                <span className="text-sm font-black">
                  ₹{report.gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  {report.total_revenue > 0 && (
                    <span className="text-xs font-bold ml-1.5 opacity-85">
                      ({((report.gross_profit / report.total_revenue) * 100).toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="border-l border-current/25 pl-6">
                <span className="text-[9px] uppercase tracking-widest block opacity-70">Net Operating Profit</span>
                <span className="text-sm font-black">₹{report.net_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-extrabold">
              <span>Net Profit Change:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                report.net_profit_variance >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}>
                {report.net_profit_variance >= 0 ? '+' : ''}
                ₹{report.net_profit_variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
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
                    <th className="px-6 py-4 text-right">Current Period (₹)</th>
                    <th className="px-6 py-4 text-right">Previous Period (₹)</th>
                    <th className="px-6 py-4 text-right">Variance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  
                  {/* REVENUE SECTION */}
                  <tr className="bg-indigo-50/10 font-black text-slate-900 border-t border-slate-200">
                    <td colSpan={5} className="px-6 py-3 text-[11px] uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" /> REVENUE (Credit Postings)
                    </td>
                  </tr>
                  {renderSectionRows(report.revenue)}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs border-b border-slate-200">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">TOTAL REVENUE</td>
                    <td className="px-6 py-4 text-right text-indigo-700 font-bold">
                      ₹{report.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{report.prev_total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-700">
                      ₹{(report.total_revenue - report.prev_total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* COGS SECTION */}
                  <tr className="bg-orange-50/10 font-black text-slate-900 border-t border-slate-200">
                    <td colSpan={5} className="px-6 py-3 text-[11px] uppercase tracking-wider text-orange-700 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> COST OF GOODS SOLD (COGS)
                    </td>
                  </tr>
                  {renderSectionRows(report.cogs, true)}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs border-b border-slate-200">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">TOTAL COST OF GOODS SOLD</td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{report.total_cogs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{report.prev_total_cogs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{(report.total_cogs - report.prev_total_cogs).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* GROSS PROFIT INTERMEDIATE ROW */}
                  <tr className="bg-slate-100 font-extrabold text-slate-950 text-xs border-t border-b border-slate-250">
                    <td colSpan={2} className="px-6 py-4">GROSS OPERATING PROFIT</td>
                    <td className="px-6 py-4 text-right text-emerald-700 text-sm">
                      ₹{report.gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{report.prev_gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-6 py-4 text-right font-black ${report.gross_profit_variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      ₹{report.gross_profit_variance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* OPERATING EXPENSES SECTION */}
                  <tr className="bg-rose-50/10 font-black text-slate-900 border-t border-slate-200">
                    <td colSpan={5} className="px-6 py-3 text-[11px] uppercase tracking-wider text-rose-700 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" /> OPERATING EXPENSES
                    </td>
                  </tr>
                  {renderSectionRows(report.expenses, true)}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs border-b border-slate-200">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">TOTAL OPERATING EXPENSES</td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{report.total_expenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{report.prev_total_expenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{(report.total_expenses - report.prev_total_expenses).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* NET PROFIT FINAL ROW */}
                  <tr className="bg-slate-200/80 font-black text-slate-900 text-xs border-t-2 border-slate-350">
                    <td colSpan={2} className="px-6 py-5 text-[13px]">NET OPERATING PROFIT / (LOSS)</td>
                    <td className="px-6 py-5 text-right text-emerald-800 text-sm font-black">
                      ₹{report.net_profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 text-right text-slate-600 font-bold">
                      ₹{report.prev_net_profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-6 py-5 text-right font-black text-sm ${report.net_profit_variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      ₹{report.net_profit_variance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

export default ProfitAndLoss;
