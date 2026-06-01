import { useEffect, useState } from 'react';
import { getInvoices, postInvoiceVoucher } from "../api";
import { Link } from 'react-router-dom';
import { ShieldCheck, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingAction, setLoadingAction] = useState<Record<string, boolean>>({});

  const fetchInvoices = () => {
    getInvoices().then(res => setInvoices(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePostLedger = async (invId: string) => {
    setLoadingAction(prev => ({ ...prev, [invId]: true }));
    try {
      await postInvoiceVoucher(invId);
      toast.success("AP Invoice matching verified and posted to operational ledger!");
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Ledger posting failed.");
    } finally {
      setLoadingAction(prev => ({ ...prev, [invId]: false }));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Accounts Payable Invoices</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Operational payables matching, accruals routing, and balanced ledger postings</p>
        </div>
        <Link to="/invoices/new" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/10 hover:bg-blue-700 text-xs font-bold transition-all">Enter Invoice</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-xs text-left text-slate-500">
          <thead className="text-[10px] text-slate-400 font-bold uppercase bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-3.5">Invoice Number</th>
              <th className="px-6 py-3.5">PO ID</th>
              <th className="px-6 py-3.5">Invoice Date</th>
              <th className="px-6 py-3.5 text-right">Taxable base</th>
              <th className="px-6 py-3.5 text-right">Total Amount</th>
              <th className="px-6 py-3.5 text-center">Status</th>
              <th className="px-6 py-3.5 text-right">Action Gateway</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {invoices.map(inv => {
              const activeLoading = loadingAction[inv.id] || false;
              const isPosted = inv.status === 'APPROVED' || inv.status === 'PAID';
              
              return (
                <tr key={inv.id} className="hover:bg-slate-50/20">
                  <td className="px-6 py-4 font-bold text-slate-900">{inv.invoice_number}</td>
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-400">{inv.po_id.substring(0,8)}...</td>
                  <td className="px-6 py-4">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right text-slate-450">₹{parseFloat((inv.total_amount - (inv.gst_amount || 0)).toString()).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">₹{parseFloat(inv.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                      inv.status === 'APPROVED' || inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      inv.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' :
                      'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isPosted ? (
                      <span className="text-[10px] text-emerald-600 font-bold uppercase flex items-center justify-end gap-1">
                        <ShieldCheck className="w-4 h-4" /> Posted to Ledger
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePostLedger(inv.id)}
                        disabled={activeLoading}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ml-auto shadow shadow-blue-600/5"
                      >
                        {activeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        Approve & Post Ledger
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-center text-slate-400">No invoices entered yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
