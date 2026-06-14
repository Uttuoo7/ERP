import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Calendar, RefreshCw, AlertTriangle, CheckCircle2, ChevronRight, Activity, DollarSign, Wallet 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCashFlow } from '../../api';

interface WCAdjustment {
  account_code: string;
  account_name: string;
  change_type: 'ASSET' | 'LIABILITY';
  change_amount: number;
  impact_on_cash: number;
}

interface FinancingAdjustment {
  account_code: string;
  account_name: string;
  change_amount: number;
  impact_on_cash: number;
}

interface CashFlowReport {
  start_date: string;
  end_date: string;
  net_profit: number;
  working_capital_adjustments: WCAdjustment[];
  operating_wc_change: number;
  operating_cash_flow: number;
  investing_cash_flow: number;
  financing_adjustments: FinancingAdjustment[];
  financing_cash_flow: number;
  net_cash_movement: number;
  opening_cash: number;
  closing_cash: number;
  reconciliation_balanced: boolean;
  difference: number;
}

const CashFlowStatement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CashFlowReport | null>(null);
  
  // Custom date ranges
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [periodPreset, setPeriodPreset] = useState<'monthly' | 'quarterly' | 'custom'>('monthly');

  const fetchCashFlowReport = async () => {
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
      }

      const res = await getCashFlow(params);
      setReport(res.data);
      
      if (res.data) {
        setStartDate(res.data.start_date.split('T')[0]);
        setEndDate(res.data.end_date.split('T')[0]);
      }
    } catch (err) {
      toast.error('Failed to load Cash Flow Statement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashFlowReport();
  }, [periodPreset]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <Wallet className="w-6 h-6 text-indigo-600" /> Cash Flow Statement
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Indirect method reconciliation starting with Net Income, adjusting for Working Capital changes and Owner Equity financing activities.
          </p>
        </div>

        {/* Presets */}
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
        <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
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
          <button 
            onClick={fetchCashFlowReport}
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
          Calculating Cash Flow Statement...
        </div>
      ) : !report ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
          <AlertTriangle className="w-12 h-12 text-slate-350 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Failed to Load</h3>
          <p className="text-xs text-slate-400 mt-1">Please try refreshing the page or checking backend connection.</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in">
          
          {/* Validation Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold shadow-sm ${
            report.reconciliation_balanced 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
              : 'bg-rose-50 text-rose-700 border-rose-150 animate-pulse'
          }`}>
            <div className="flex gap-4">
              <div>
                <span className="text-[9px] uppercase tracking-widest block opacity-70">Opening Cash</span>
                <span className="text-sm font-black">₹{report.opening_cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-l border-current/25 pl-4">
                <span className="text-[9px] uppercase tracking-widest block opacity-70">Net Cash Movement</span>
                <span className="text-sm font-black text-indigo-700">
                  {report.net_cash_movement >= 0 ? '+' : ''}
                  ₹{report.net_cash_movement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-current/25 pl-4">
                <span className="text-[9px] uppercase tracking-widest block opacity-70">Closing Cash</span>
                <span className="text-sm font-black">₹{report.closing_cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {report.reconciliation_balanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>CASH RECONCILIATION SUCCESSFUL (OPENING + MOVEMENT = CLOSING)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>CASH DISCREPANCY DETECTED (DIFF: ₹{report.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
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
                    <th className="px-6 py-4 w-1/5">Account Code</th>
                    <th className="px-6 py-4 w-2/5">Cash Flow Activities / Adjustments</th>
                    <th className="px-6 py-4 text-right">Balance Change (₹)</th>
                    <th className="px-6 py-4 text-right">Impact on Cash (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  
                  {/* OPERATING ACTIVITIES SECTION */}
                  <tr className="bg-indigo-50/10 font-black text-slate-900 border-t border-slate-200">
                    <td colSpan={4} className="px-6 py-3 text-[11px] uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                      <Activity className="w-4 h-4" /> 1. CASH FLOWS FROM OPERATING ACTIVITIES
                    </td>
                  </tr>
                  
                  {/* Start with Net Income */}
                  <tr className="hover:bg-slate-50/20 font-bold">
                    <td className="px-6 py-3 text-slate-400 font-mono">-</td>
                    <td className="px-6 py-3 text-slate-800">Net profit/loss before tax (Income Statement)</td>
                    <td className="px-6 py-3 text-right">-</td>
                    <td className="px-6 py-3 text-right text-slate-950 font-black">
                      ₹{report.net_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* WC Adjustments Header */}
                  <tr className="bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <td colSpan={4} className="px-6 py-1.5 pl-12">Working Capital Adjustments:</td>
                  </tr>

                  {/* List WC Adjustments */}
                  {report.working_capital_adjustments.map((adj, idx) => {
                    const isCashInflow = adj.impact_on_cash >= 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-6 py-2.5 font-mono text-slate-500 pl-12">{adj.account_code}</td>
                        <td className="px-6 py-2.5 text-slate-700 font-medium">
                          {adj.account_name} 
                          <span className="text-[10px] text-slate-400 ml-1.5 font-bold">
                            ({adj.change_type === 'ASSET' ? 'Increase in Asset' : 'Increase in Liability'})
                          </span>
                        </td>
                        <td className="px-6 py-2.5 text-right text-slate-500">
                          {adj.change_amount >= 0 ? '+' : ''}
                          ₹{adj.change_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`px-6 py-2.5 text-right font-bold ${isCashInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCashInflow ? '+' : '-'}
                          ₹{Math.abs(adj.impact_on_cash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  {report.working_capital_adjustments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-3 text-center text-slate-400 text-xs italic pl-12">
                        No working capital changes in this period
                      </td>
                    </tr>
                  )}

                  {/* Operating Cash Flow Total */}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">NET CASH GENERATED FROM OPERATING ACTIVITIES</td>
                    <td className="px-6 py-4 text-right font-medium">
                      {report.operating_wc_change >= 0 ? '+' : ''}
                      ₹{report.operating_wc_change.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-700 text-sm">
                      ₹{report.operating_cash_flow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* INVESTING ACTIVITIES SECTION */}
                  <tr className="bg-orange-50/10 font-black text-slate-900 border-t border-slate-200">
                    <td colSpan={4} className="px-6 py-3 text-[11px] uppercase tracking-wider text-orange-700 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> 2. CASH FLOWS FROM INVESTING ACTIVITIES
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/20 font-bold">
                    <td className="px-6 py-3 text-slate-400 font-mono">-</td>
                    <td className="px-6 py-3 text-slate-800">Purchases of Fixed Assets / Capital investments</td>
                    <td className="px-6 py-3 text-right">-</td>
                    <td className="px-6 py-3 text-right text-slate-500">₹0.00</td>
                  </tr>
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">NET CASH USED IN INVESTING ACTIVITIES</td>
                    <td className="px-6 py-4 text-right font-medium">-</td>
                    <td className="px-6 py-4 text-right text-slate-900">₹0.00</td>
                  </tr>

                  {/* FINANCING ACTIVITIES SECTION */}
                  <tr className="bg-emerald-50/10 font-black text-slate-900 border-t border-slate-200">
                    <td colSpan={4} className="px-6 py-3 text-[11px] uppercase tracking-wider text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> 3. CASH FLOWS FROM FINANCING ACTIVITIES
                    </td>
                  </tr>
                  {report.financing_adjustments.map((adj, idx) => {
                    const isCashInflow = adj.impact_on_cash >= 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-6 py-2.5 font-mono text-slate-500 pl-12">{adj.account_code}</td>
                        <td className="px-6 py-2.5 text-slate-700 font-medium">
                          {adj.account_name} 
                        </td>
                        <td className="px-6 py-2.5 text-right text-slate-500">
                          {adj.change_amount >= 0 ? '+' : ''}
                          ₹{adj.change_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`px-6 py-2.5 text-right font-bold ${isCashInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCashInflow ? '+' : '-'}
                          ₹{Math.abs(adj.impact_on_cash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  {report.financing_adjustments.length === 0 && (
                    <tr className="hover:bg-slate-50/20 font-bold">
                      <td className="px-6 py-3 text-slate-400 font-mono">-</td>
                      <td className="px-6 py-3 text-slate-800">Owner Equity contributions / drawings / distributions</td>
                      <td className="px-6 py-3 text-right">-</td>
                      <td className="px-6 py-3 text-right text-slate-500">₹0.00</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50/60 font-black text-slate-900 text-xs">
                    <td colSpan={2} className="px-6 py-4 pl-12 text-slate-800">NET CASH FROM FINANCING ACTIVITIES</td>
                    <td className="px-6 py-4 text-right font-medium">-</td>
                    <td className="px-6 py-4 text-right text-slate-900">
                      ₹{report.financing_cash_flow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* SUMMARY SECTION */}
                  <tr className="bg-slate-100 font-extrabold text-slate-950 text-xs border-t-2 border-slate-350">
                    <td colSpan={2} className="px-6 py-4">NET INCREASE / (DECREASE) IN CASH & BANK</td>
                    <td className="px-6 py-4 text-right font-medium">-</td>
                    <td className="px-6 py-4 text-right text-indigo-700 text-sm font-black">
                      ₹{report.net_cash_movement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/80 font-bold text-slate-900 text-xs border-t border-slate-200">
                    <td colSpan={2} className="px-6 py-3 pl-12">Cash and cash equivalents at the beginning of the period</td>
                    <td className="px-6 py-3 text-right font-medium">-</td>
                    <td className="px-6 py-3 text-right text-slate-600 font-bold">
                      ₹{report.opening_cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr className="bg-slate-200 font-black text-slate-950 text-xs border-t-2 border-slate-300">
                    <td colSpan={2} className="px-6 py-4 text-[13px] uppercase">Cash and cash equivalents at the end of the period</td>
                    <td className="px-6 py-4 text-right font-medium">-</td>
                    <td className="px-6 py-4 text-right text-emerald-800 text-sm font-black">
                      ₹{report.closing_cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

export default CashFlowStatement;
