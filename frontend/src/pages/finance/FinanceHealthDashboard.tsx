import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, AlertCircle, CheckCircle2, RefreshCw, Layers, DollarSign, Clock, FileText, ArrowRightLeft, BookOpen, ChevronRight, Activity 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getFinanceHealth } from '../../api';

interface Alert {
  type: 'RED' | 'AMBER' | 'GREEN';
  message: string;
}

interface AutoPostingInfo {
  entry_number: string;
  entry_date: string;
  reference_type: string;
}

interface AuditStatus {
  trial_balance_status: 'GREEN' | 'AMBER' | 'RED';
  ap_status: 'GREEN' | 'AMBER' | 'RED';
  grni_status: 'GREEN' | 'AMBER' | 'RED';
  open_periods_count: number;
  last_successful_auto_posting: AutoPostingInfo | null;
  last_jv_number: string | null;
}

interface FinanceHealthData {
  trial_balance: {
    total_debit: number;
    total_credit: number;
    difference: number;
    status: 'GREEN' | 'RED';
  };
  ap_reconciliation: {
    gl_balance: number;
    subledger_balance: number;
    difference: number;
    status: 'GREEN' | 'AMBER' | 'RED';
  };
  grni_reconciliation: {
    gl_balance: number;
    subledger_balance: number;
    difference: number;
    status: 'GREEN' | 'AMBER' | 'RED';
  };
  cash_position: number;
  open_periods: string[];
  last_journal_voucher: {
    entry_number: string;
    entry_date: string;
    reference_type: string;
    narration: string | null;
  } | null;
  unposted_transactions: {
    grns: number;
    invoices: number;
    payments: number;
    total: number;
  };
  alerts: Alert[];
  audit_status?: AuditStatus;
  inventory_health?: {
    inventory_asset_value: number;
    cogs_mtd: number;
    inventory_turnover: number;
    dead_stock_exposure: number;
    negative_inventory_count: number;
    inventory_in_transit_value: number;
  };
}

const FinanceHealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<FinanceHealthData | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await getFinanceHealth();
      setHealth(res.data);
    } catch (err) {
      toast.error('Failed to load Finance Health Dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading && !health) {
    return (
      <div className="text-center py-24 text-slate-400 text-xs font-semibold">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
        Performing Finance Core Audit...
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-slate-350 mx-auto mb-3" />
        <h3 className="text-sm font-extrabold text-slate-900">Failed to Load Dashboard</h3>
        <p className="text-xs text-slate-400 mt-1">Check database migrations or restart services.</p>
        <button onClick={fetchHealth} className="mt-4 px-4 py-1.5 bg-indigo-600 text-white rounded font-bold text-xs">
          Retry Audit
        </button>
      </div>
    );
  }

  const getStatusColor = (status: 'GREEN' | 'AMBER' | 'RED') => {
    if (status === 'GREEN') return 'border-l-4 border-l-emerald-500 bg-emerald-50/20 text-emerald-700';
    if (status === 'AMBER') return 'border-l-4 border-l-amber-500 bg-amber-50/20 text-amber-700';
    return 'border-l-4 border-l-rose-500 bg-rose-50/20 text-rose-700';
  };

  const getStatusBadge = (status: 'GREEN' | 'AMBER' | 'RED') => {
    if (status === 'GREEN') return <span className="px-2 py-0.5 rounded text-[8px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">MATCHED</span>;
    if (status === 'AMBER') return <span className="px-2 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-800 border border-amber-200">WARNING</span>;
    return <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">MISMATCH</span>;
  };

  const getAuditStatusBadge = (status: 'GREEN' | 'AMBER' | 'RED') => {
    if (status === 'GREEN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1 h-1 rounded-full bg-emerald-500"></span>CLEAN
        </span>
      );
    }
    if (status === 'AMBER') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1 h-1 rounded-full bg-amber-500"></span>VARIANCE EXISTS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
        <span className="w-1 h-1 rounded-full bg-rose-500"></span>CRITICAL FAILURE
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 animate-pulse" /> Financial Health & Governance
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Real-time subledger audits, trial balance certification monitoring, and unposted transaction queue metrics.
          </p>
        </div>
        <button 
          onClick={fetchHealth}
          className="p-2 bg-white border border-slate-200 hover:border-slate-350 rounded-xl transition-all shadow-xs text-slate-600 hover:text-slate-900"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Audit Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" /> Audit Status Card
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs mb-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-450">Trial Balance Status</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-extrabold text-slate-800">
                {health.trial_balance.status === 'GREEN' ? '✓ Balanced' : '✗ Imbalanced'}
              </span>
              {getAuditStatusBadge(health.audit_status?.trial_balance_status || (health.trial_balance.status === 'GREEN' ? 'GREEN' : 'RED'))}
            </div>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-450">AP Reconciliation Status</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-extrabold text-slate-800">
                Diff: ₹{health.ap_reconciliation.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              {getAuditStatusBadge(health.audit_status?.ap_status || health.ap_reconciliation.status)}
            </div>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-450">GRNI Reconciliation Status</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-extrabold text-slate-800">
                Diff: ₹{health.grni_reconciliation.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              {getAuditStatusBadge(health.audit_status?.grni_status || health.grni_reconciliation.status)}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs pt-4 border-t border-slate-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Open Fiscal Periods</span>
            <span className="font-bold text-slate-700">{health.audit_status?.open_periods_count ?? health.open_periods.length} periods open</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Last Successful Auto Posting</span>
            <span className="font-bold text-slate-700">
              {health.audit_status?.last_successful_auto_posting ? (
                <span>
                  <strong className="text-indigo-600">{health.audit_status.last_successful_auto_posting.entry_number}</strong>
                  <span className="text-slate-400 text-[10px] block font-medium">
                    Type: {health.audit_status.last_successful_auto_posting.reference_type} | Date: {new Date(health.audit_status.last_successful_auto_posting.entry_date).toLocaleDateString()}
                  </span>
                </span>
              ) : (
                <span className="text-slate-400 italic">None</span>
              )}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Last JV Number</span>
            <span className="font-bold text-slate-750">
              {health.audit_status?.last_jv_number ? (
                <strong className="text-slate-800">{health.audit_status.last_jv_number}</strong>
              ) : (
                <span className="text-slate-400 italic">N/A</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of 8 widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
        
        {/* 1. Trial Balance Status */}
        <div 
          onClick={() => navigate('/finance/reports?tab=trial_balance')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Trial Balance Status</span>
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {health.trial_balance.status === 'GREEN' ? '✓ Balanced' : '✗ Imbalanced'}
          </div>
          <div className="mt-2 text-slate-500 font-semibold">
            Debits equal Credits parity:
            <span className={`block font-extrabold mt-0.5 ${health.trial_balance.status === 'GREEN' ? 'text-emerald-600' : 'text-rose-600'}`}>
              ₹{health.trial_balance.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* 2. AP Reconciliation */}
        <div 
          onClick={() => navigate('/finance/ap-reconciliation')}
          className={`border border-slate-200 rounded-2xl p-5 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] ${getStatusColor(health.ap_reconciliation.status)}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-extrabold uppercase tracking-wider text-[10px] opacity-75">AP vs Subledger</span>
            {getStatusBadge(health.ap_reconciliation.status)}
          </div>
          <div className="text-xl font-black">
            ₹{health.ap_reconciliation.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 opacity-75 font-semibold">
            AP GL: ₹{health.ap_reconciliation.gl_balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            <span className="block">
              Subledger: ₹{health.ap_reconciliation.subledger_balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* 3. GRNI Reconciliation */}
        <div 
          onClick={() => navigate('/finance/grni-reconciliation')}
          className={`border border-slate-200 rounded-2xl p-5 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] ${getStatusColor(health.grni_reconciliation.status)}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-extrabold uppercase tracking-wider text-[10px] opacity-75">GRNI vs Uninvoiced</span>
            {getStatusBadge(health.grni_reconciliation.status)}
          </div>
          <div className="text-xl font-black">
            ₹{health.grni_reconciliation.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 opacity-75 font-semibold">
            GRNI GL: ₹{health.grni_reconciliation.gl_balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            <span className="block">
              Uninvoiced GRNs: ₹{health.grni_reconciliation.subledger_balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* 4. Cash & Bank Position */}
        <div 
          onClick={() => navigate('/finance/reports?tab=account_ledger&accountId=' + (health.cash_position ? '1000' : ''))}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] border-l-4 border-l-indigo-600 bg-indigo-50/5"
        >
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Cash & Bank Position</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            ₹{health.cash_position.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-slate-500 font-semibold">
            Account Code: <strong className="text-slate-700">1000</strong>
            <span className="block mt-0.5">Liquid cash asset balance</span>
          </div>
        </div>

        {/* 5. Open Fiscal Period */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Active Posting Period</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {health.open_periods.length > 0 ? health.open_periods[0] : 'None'}
          </div>
          <div className="mt-2 text-slate-500 font-semibold">
            Open periods allowed to post:
            <span className="block font-bold mt-1 text-slate-700">
              {health.open_periods.join(', ') || 'Fiscal year locked'}
            </span>
          </div>
        </div>

        {/* 6. Last Journal Entry */}
        <div 
          onClick={() => navigate('/finance/reports?tab=general_ledger')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Last Journal Voucher</span>
            <BookOpen className="w-4 h-4" />
          </div>
          {health.last_journal_voucher ? (
            <>
              <div className="font-extrabold text-slate-900">{health.last_journal_voucher.entry_number}</div>
              <div className="mt-2 text-slate-500 font-medium leading-relaxed line-clamp-2">
                {health.last_journal_voucher.narration || 'No narration'}
                <span className="block text-[10px] text-slate-400 mt-1 font-bold">
                  Date: {new Date(health.last_journal_voucher.entry_date).toLocaleDateString()}
                </span>
              </div>
            </>
          ) : (
            <div className="text-slate-400 italic">No entries posted yet</div>
          )}
        </div>

        {/* 7. Unposted Transactions Queue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Unposted Auto-Queues</span>
            <Activity className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{health.unposted_transactions.total} pending</div>
          <div className="mt-2 text-slate-500 font-semibold">
            GRNs: {health.unposted_transactions.grns} | Invoices: {health.unposted_transactions.invoices}
            <span className="block mt-0.5">Payments: {health.unposted_transactions.payments}</span>
          </div>
        </div>

        {/* 8. Alert Summary */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 text-slate-400">
              <span className="font-extrabold uppercase tracking-wider text-[10px]">Governance Alerts</span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-slate-900">{health.alerts.length} Warnings</div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Review alerts summary below
          </div>
        </div>

      </div>
      
      {/* Inventory Governance & Valuation Health */}
      {health.inventory_health && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-indigo-600 animate-pulse" /> Inventory Control & Valuation Governance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 text-xs">
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Inventory Asset Value</span>
              <span className="text-lg font-black text-slate-900">₹{health.inventory_health.inventory_asset_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-slate-400 font-bold block mt-2">GL Code: 1200</span>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">COGS MTD</span>
              <span className="text-lg font-black text-slate-900">₹{health.inventory_health.cogs_mtd.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-slate-400 font-bold block mt-2">GL Code: 5000</span>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Inventory Turnover Ratio</span>
              <span className="text-lg font-black text-slate-900">{health.inventory_health.inventory_turnover.toFixed(2)}x</span>
              <span className="text-[10px] text-slate-450 font-bold block mt-2">
                DSI: {health.inventory_health.inventory_turnover > 0 ? (365 / health.inventory_health.inventory_turnover).toFixed(1) : '365'} days
              </span>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Obsolete Stock Exposure</span>
              <span className="text-lg font-black text-slate-900">₹{health.inventory_health.dead_stock_exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-slate-400 font-bold block mt-2">Slow-moving/Dead assets</span>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              health.inventory_health.negative_inventory_count > 0 ? 'bg-rose-50/20 border-rose-200 text-rose-700' : 'bg-slate-50/50 border-slate-100'
            }`}>
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Negative Stock Records</span>
              <span className={`text-lg font-black ${health.inventory_health.negative_inventory_count > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {health.inventory_health.negative_inventory_count} Items
              </span>
              <span className="text-[10px] font-bold block mt-2">Reconciliation Warning</span>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">In-Transit Valuation</span>
              <span className="text-lg font-black text-slate-900">₹{health.inventory_health.inventory_in_transit_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-slate-400 font-bold block mt-2">GL Code: 1250</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Detailed Alert Console & Log Stream */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        
        {/* Alerts Console (Left col, span 2) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-600" /> Active Governance Warnings
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-black">
              {health.alerts.length} alerts require review
            </span>
          </div>
          
          <div className="p-4 divide-y divide-slate-150 flex-1">
            {health.alerts.map((alert, idx) => (
              <div key={idx} className="py-3 flex items-start gap-3">
                <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                  alert.type === 'RED' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'
                }`} />
                <div>
                  <h4 className="font-bold text-slate-800">
                    {alert.type === 'RED' ? 'CRITICAL DISCREPANCY' : 'WARNING NOTIFICATION'}
                  </h4>
                  <p className="text-slate-500 font-medium mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
            {health.alerts.length === 0 && (
              <div className="py-12 text-center text-slate-400 font-semibold">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                All internal ledger audits successfully passed. No alerts.
              </div>
            )}
          </div>
        </div>

        {/* Quick Auditing Links (Right col) */}
        <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] text-slate-400 mb-4">
              Audit Workspaces
            </h3>
            
            <div className="space-y-2">
              <button 
                onClick={() => navigate('/finance/reports?tab=trial_balance')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all text-left font-bold text-slate-700"
              >
                <span>1. View Trial Balance Sheet</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              <button 
                onClick={() => navigate('/finance/ap-reconciliation')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all text-left font-bold text-slate-700"
              >
                <span>2. AP Reconciliation subledger</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
              <button 
                onClick={() => navigate('/finance/grni-reconciliation')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all text-left font-bold text-slate-700"
              >
                <span>3. GRNI Accruals subledger</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 text-[10px] text-slate-400 font-semibold leading-relaxed">
            Note: All audit data is polled and verified against the general ledger. Verify imbalanced alerts before closing periods.
          </div>
        </div>

      </div>

    </div>
  );
};

export default FinanceHealthDashboard;
