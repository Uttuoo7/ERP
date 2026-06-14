import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRightLeft, AlertTriangle, CheckCircle2, ChevronRight, ChevronDown, DollarSign, RefreshCw, FileText, User 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAPReconciliation } from '../../api';

interface OutstandingInvoice {
  liability_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  original_amount: number;
  outstanding_amount: number;
  status: string;
}

interface VendorReconDetail {
  vendor_id: string;
  vendor_name: string;
  original_amount: number;
  outstanding_amount: number;
  invoices: OutstandingInvoice[];
}

interface APReconReport {
  gl_balance: number;
  subledger_balance: number;
  difference: number;
  status: 'MATCHED' | 'MISMATCH';
  vendors: VendorReconDetail[];
}

const APReconciliation: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<APReconReport | null>(null);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  const fetchReconciliation = async () => {
    setLoading(true);
    try {
      const res = await getAPReconciliation();
      setReport(res.data);
    } catch (err) {
      toast.error('Failed to load Accounts Payable Reconciliation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliation();
  }, []);

  const handleDrillDownGL = () => {
    // Navigate to Account Ledger tab and select Accounts Payable (code 2000)
    // We can lookup by code directly or route
    navigate(`/finance/reports?tab=account_ledger&accountId=2000`);
  };

  if (loading && !report) {
    return (
      <div className="text-center py-24 text-slate-400 text-xs font-semibold">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
        Analyzing AP subledger postings...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center">
        <AlertTriangle className="w-12 h-12 text-slate-350 mx-auto mb-3" />
        <h3 className="text-sm font-extrabold text-slate-900">Failed to Load Reconciliation</h3>
        <p className="text-xs text-slate-400 mt-1">Please ensure the Accounts Payable (2000) account exists in the COA.</p>
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
            <ArrowRightLeft className="w-6 h-6 text-indigo-600" /> Accounts Payable GL vs Subledger
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Audit ledger reconciliation matching the GL Accounts Payable Control balance with the outstanding vendor liability subledger details.
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
        
        {/* Card 1: GL AP Balance */}
        <div 
          onClick={handleDrillDownGL}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-3 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            <span>Accounts Payable GL (2000)</span>
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
            <span>Vendor Liabilities Subledger</span>
            <User className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{report.subledger_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-slate-400 font-semibold">
            Aggregated outstanding unpaid invoices
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
            <h4 className="font-bold">AP Subledger Posting Discrepancy detected</h4>
            <p className="mt-0.5 text-slate-600 font-medium">
              Discrepancies between the GL control account (2000) and the Vendor Liabilities subledger usually occur if:
            </p>
            <ul className="list-disc list-inside mt-1 pl-2 text-slate-500 font-medium space-y-0.5">
              <li>Manual journal entries have been posted to the AP Control (2000) account without creating vendor liabilities.</li>
              <li>Existing invoices have been approved but the automated posting listener was temporarily disabled.</li>
              <li>Direct database manipulation of transactions or subledger records occurred.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Vendors Subledger Details list */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subledger Breakdown By Vendor</h3>
        
        <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden font-semibold text-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4 w-12"></th>
                  <th className="px-6 py-4">Vendor Name</th>
                  <th className="px-6 py-4 text-right">Original Value (₹)</th>
                  <th className="px-6 py-4 text-right">Outstanding Liability (₹)</th>
                  <th className="px-6 py-4 text-right">Vouchers Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.vendors.map((vendor) => {
                  const isExpanded = expandedVendorId === vendor.vendor_id;
                  return (
                    <React.Fragment key={vendor.vendor_id}>
                      {/* Vendor Row */}
                      <tr 
                        onClick={() => setExpandedVendorId(isExpanded ? null : vendor.vendor_id)}
                        className="hover:bg-slate-50 cursor-pointer font-bold"
                      >
                        <td className="px-6 py-4 text-center">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </td>
                        <td className="px-6 py-4 text-slate-900 font-black text-sm">{vendor.vendor_name}</td>
                        <td className="px-6 py-4 text-right text-slate-500">
                          ₹{vendor.original_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-indigo-700 font-black">
                          ₹{vendor.outstanding_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 font-mono">{vendor.invoices.length}</td>
                      </tr>

                      {/* Expandable Invoice Details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50/40 px-12 py-4 border-t border-b border-slate-100">
                            <div className="overflow-x-auto rounded-xl border border-slate-150 bg-white">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-150 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    <th className="px-4 py-2">Invoice Number</th>
                                    <th className="px-4 py-2">Invoice Date</th>
                                    <th className="px-4 py-2">Due Date</th>
                                    <th className="px-4 py-2 text-right">Original Amount (₹)</th>
                                    <th className="px-4 py-2 text-right">Outstanding Amount (₹)</th>
                                    <th className="px-4 py-2 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                  {vendor.invoices.map((inv) => (
                                    <tr 
                                      key={inv.liability_id} 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/invoices/${inv.liability_id}`); // Mock or navigate to actual workspace
                                      }}
                                      className="hover:bg-indigo-50/10 cursor-pointer"
                                    >
                                      <td className="px-4 py-2.5 font-bold text-slate-800 font-mono">{inv.invoice_number}</td>
                                      <td className="px-4 py-2.5 text-slate-500">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                      <td className="px-4 py-2.5 text-slate-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                                      <td className="px-4 py-2.5 text-right">
                                        ₹{inv.original_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                                        ₹{inv.outstanding_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-2.5 text-right">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                                          inv.status === 'UNPAID' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                        }`}>
                                          {inv.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                  {vendor.invoices.length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="py-6 text-center text-slate-400 italic">No invoices outstanding</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {report.vendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      No vendor liabilities outstanding. Subledger is clean.
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

export default APReconciliation;
