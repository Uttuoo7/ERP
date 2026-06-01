import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, ShieldCheck, AlertTriangle, Play, Landmark, Plus, Search, Filter, Loader2, Sparkles, Receipt, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getInvoices, runInvoiceMatch } from "../api";

const InvoiceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actioningId, setActioningId] = useState("");

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await getInvoices(statusFilter ? { status_filter: statusFilter } : {});
      setInvoices(res.data);
    } catch (err) {
      toast.error("Failed to fetch Accounts Payable invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const handleTriggerMatch = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActioningId(id);
    try {
      await runInvoiceMatch(id);
      toast.success("3-Way Match Check executed successfully!");
      fetchInvoices();
    } catch (err) {
      // Handled globally
    } finally {
      setActioningId("");
    }
  };

  // Calculations
  const filtered = invoices.filter(inv => {
    const num = inv.invoice_number.toLowerCase();
    const vNum = (inv.vendor_invoice_number || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return num.includes(query) || vNum.includes(query);
  });

  const totalBilled = invoices.reduce((sum, x) => sum + parseFloat(x.total_amount), 0);
  const mismatches = invoices.filter(x => x.status === 'MISMATCH_DETECTED').length;
  const cleanMatched = invoices.filter(x => x.status === 'MATCHED').length;
  const posted = invoices.filter(x => x.status === 'APPROVED' || x.status === 'POSTED' || x.status === 'PAID').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Accounts Payable Dashboard</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Operational invoice reconciliations, 3-way discrepancy logs, and Tally ready entries</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/invoices/new"
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
          >
            <Plus className="w-4.5 h-4.5" />
            Enter Vendor Invoice
          </Link>
        </div>
      </div>

      {/* AP Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed Accruals</span>
            <span className="text-lg font-black text-slate-900">₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Clean Matched</span>
            <span className="text-lg font-black text-emerald-600">{cleanMatched} Invoices</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mismatch Exceptions</span>
            <span className="text-lg font-black text-rose-600">{mismatches} Invoices</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Posted to Ledger</span>
            <span className="text-lg font-black text-slate-900">{posted} Invoices</span>
          </div>
        </div>
      </div>

      {/* Invoice Table list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Invoice number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white outline-none focus:border-blue-500 font-semibold"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-white font-semibold text-slate-700"
            >
              <option value="">-- All Matching Statuses --</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_MATCHING">Pending Match check</option>
              <option value="MATCHED">Matched</option>
              <option value="MISMATCH_DETECTED">Mismatch Detected</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted to Ledger</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-bold">Consolidating payables lists...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3.5">Invoice Numbers</th>
                  <th className="px-4 py-3.5">Invoice Date</th>
                  <th className="px-4 py-3.5 text-right">Accrued Amount</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Workflow</th>
                  <th className="px-4 py-3.5 text-right">Verification Gateway</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-450">No invoices entered yet.</td>
                  </tr>
                ) : (
                  filtered.map(inv => {
                    const statusColors = 
                      inv.status === 'MATCHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      inv.status === 'MISMATCH_DETECTED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                      inv.status === 'APPROVED' || inv.status === 'POSTED' || inv.status === 'PAID' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                      'bg-slate-100 text-slate-500 border-slate-200';

                    const canMatch = inv.status === 'DRAFT' || inv.status === 'MISMATCH_DETECTED' || inv.status === 'PENDING_MATCHING';
                    const activeMatchLoading = actioningId === inv.id;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/20">
                        <td className="px-4 py-4">
                          <Link to={`/invoices/${inv.id}`} className="hover:text-blue-600 block">
                            <span className="font-extrabold text-slate-900 block">{inv.invoice_number}</span>
                            <span className="text-[10px] text-slate-400 font-semibold block">Ref: {inv.vendor_invoice_number || 'N/A'}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-4">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                        <td className="px-4 py-4 text-right font-black text-slate-900">₹{parseFloat(inv.total_amount).toFixed(2)}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${statusColors}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-[10.5px] text-slate-500 font-bold block">{inv.workflow_state || 'DRAFT'}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {canMatch && (
                              <button
                                onClick={(e) => handleTriggerMatch(e, inv.id)}
                                disabled={activeMatchLoading}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100/50 rounded-lg text-[10px] font-black transition-all"
                              >
                                {activeMatchLoading ? <Loader2 className="w-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                                Run 3-Way Match
                              </button>
                            )}
                            <Link
                              to={`/invoices/${inv.id}`}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all border border-transparent hover:border-slate-200"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceDashboard;
