import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRightLeft, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, FileText, ClipboardList 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getGRNIReconciliation } from '../../api';

interface UninvoicedGRN {
  grn_id: string;
  grn_number: string;
  po_number: string;
  vendor_name: string;
  receipt_date: string;
  amount: number;
}

interface GRNIReconReport {
  gl_balance: number;
  subledger_balance: number;
  difference: number;
  status: 'MATCHED' | 'MISMATCH';
  uninvoiced_grns: UninvoicedGRN[];
}

const GRNIReconciliation: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GRNIReconReport | null>(null);

  const fetchReconciliation = async () => {
    setLoading(true);
    try {
      const res = await getGRNIReconciliation();
      setReport(res.data);
    } catch (err) {
      toast.error('Failed to load GRNI Reconciliation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliation();
  }, []);

  const handleDrillDownGL = () => {
    // Navigate to Account Ledger tab and select GRNI Control (code 2100)
    navigate(`/finance/reports?tab=account_ledger&accountId=2100`);
  };

  if (loading && !report) {
    return (
      <div className="text-center py-24 text-slate-400 text-xs font-semibold">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
        Auditing uninvoiced receipt accruals...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center">
        <AlertTriangle className="w-12 h-12 text-slate-350 mx-auto mb-3" />
        <h3 className="text-sm font-extrabold text-slate-900">Failed to Load Reconciliation</h3>
        <p className="text-xs text-slate-400 mt-1">Please ensure the GRNI Control (2100) account exists in the COA.</p>
      </div>
    );
  }

  const isBalanced = Math.abs(report.difference) < 0.01;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen text-xs">
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-indigo-600" /> Goods Received Not Invoiced (GRNI) Reconciliation
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Audit ledger reconciliation matching the GRNI Control accruals account balance with the outstanding uninvoiced GRN receipts subledger.
          </p>
        </div>
        <button 
          onClick={fetchReconciliation}
          className="p-2 bg-white border border-slate-200 hover:border-slate-350 rounded-xl transition-all shadow-xs text-slate-600 hover:text-slate-900"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Side-by-side totals cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: GL GRNI Balance */}
        <div 
          onClick={handleDrillDownGL}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-3 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            <span>GRNI Control GL (2100)</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{report.gl_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-slate-400 font-semibold flex items-center justify-between">
            <span>Click to explore ledger transactions</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Subledger Total */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            <span>Uninvoiced GRNs Subledger</span>
            <ClipboardList className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{report.subledger_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-slate-400 font-semibold">
            Aggregated subtotal of uninvoiced goods receipts
          </div>
        </div>

        {/* Card 3: Difference */}
        <div className={`border rounded-2xl p-5 shadow-xs flex flex-col justify-between ${
          isBalanced 
            ? 'bg-emerald-50 border-emerald-150 text-emerald-800' 
            : 'bg-rose-50 border-rose-150 text-rose-800 animate-pulse'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3 font-bold uppercase tracking-wider text-[10px] opacity-75">
              <span>Discrepancy / Variance</span>
              {isBalanced ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            </div>
            <div className="text-2xl font-black">
              ₹{report.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-2 font-black uppercase text-[9px] tracking-wider">
            {isBalanced ? '✓ Subledgers fully matched' : '⚠️ MISMATCH DETECTED'}
          </div>
        </div>

      </div>

      {/* Discrepancy explanation / Root Cause Analysis */}
      {!isBalanced && (
        <div className="p-4 rounded-xl border border-rose-150 bg-rose-50/30 text-rose-800 font-semibold leading-relaxed flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">GRNI Accruals Posting Discrepancy detected</h4>
            <p className="mt-0.5 text-slate-600 font-medium">
              Discrepancies between the GL control account (2100) and the uninvoiced GRN subledger usually occur if:
            </p>
            <ul className="list-disc list-inside mt-1 pl-2 text-slate-500 font-medium space-y-0.5">
              <li>Manual journal entries have been posted to the GRNI Control (2100) account.</li>
              <li>Receipts have been approved but the auto-posting listener failed or was disabled.</li>
              <li>Invoices were approved and posted without linking the correct GRN ID, leaving the original accrual uncleared.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Uninvoiced GRNs Breakdown list */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uninvoiced Receipts breakdown</h3>
        
        <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden font-semibold text-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">GRN Number</th>
                  <th className="px-6 py-4">Purchase Order</th>
                  <th className="px-6 py-4">Vendor Partner</th>
                  <th className="px-6 py-4">Receipt Date</th>
                  <th className="px-6 py-4 text-right">Receipt Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {report.uninvoiced_grns.map((grn) => (
                  <tr 
                    key={grn.grn_id} 
                    onClick={() => navigate(`/grns/${grn.grn_id}`)}
                    className="hover:bg-indigo-50/10 cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-black text-slate-900 font-mono group-hover:text-indigo-600 flex items-center gap-1">
                      {grn.grn_number}
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono">{grn.po_number}</td>
                    <td className="px-6 py-4 text-slate-800">{grn.vendor_name}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(grn.receipt_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right text-slate-900 font-black">
                      ₹{grn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {report.uninvoiced_grns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      All approved goods receipts have been invoiced. No outstanding accruals.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

export default GRNIReconciliation;
