import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, ShieldCheck, AlertTriangle, Landmark, FileCode, Play, Layers, CheckCircle2, XCircle, Info, RefreshCw, Loader2, ListOrdered, Share2, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getInvoice, runInvoiceMatch, resolveInvoiceVariance, postInvoiceGL, getWorkflowHistory, getDocumentLineage 
} from "../api";

const InvoiceDetailWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [lineage, setLineage] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'match' | 'ledger' | 'traceability'>('match');
  
  // Matching actions loading states
  const [matchingAction, setMatchingAction] = useState(false);
  const [resolvingAction, setResolvingAction] = useState(false);
  const [postingAction, setPostingAction] = useState(false);

  // Manual resolution override inputs
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  const fetchInvoiceDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getInvoice(id);
      setInvoice(res.data);
      
      // Populate manual resolution overrides with default "APPROVED" for mismatched lines
      const defaultRes: Record<string, string> = {};
      res.data.line_items.forEach((item: any) => {
        if (item.match_status === 'MISMATCH_DETECTED') {
          defaultRes[item.id] = "APPROVED";
        }
      });
      setResolutions(defaultRes);

      // Fetch lineage traceability
      const linRes = await getDocumentLineage("INVOICE", id);
      setLineage(linRes.data);
    } catch (err) {
      toast.error("Failed to load detailed AP invoice workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceDetails();
  }, [id]);

  const handleRunMatchCheck = async () => {
    if (!id) return;
    setMatchingAction(true);
    try {
      await runInvoiceMatch(id);
      toast.success("3-Way Matching reconciliation verify complete.");
      fetchInvoiceDetails();
    } catch (err) {
      // Handled
    } finally {
      setMatchingAction(false);
    }
  };

  const handleResolveVariance = async () => {
    if (!id) return;
    setResolvingAction(true);
    try {
      await resolveInvoiceVariance(id, resolutions);
      toast.success("Discrepancies overridden and approved successfully!");
      fetchInvoiceDetails();
    } catch (err) {
      // Handled
    } finally {
      setResolvingAction(false);
    }
  };

  const handlePostGeneralLedger = async () => {
    if (!id) return;
    setPostingAction(true);
    try {
      await postInvoiceGL(id);
      toast.success("AP Invoice accrued and posted to balanced General Ledgers!");
      fetchInvoiceDetails();
    } catch (err) {
      // Handled
    } finally {
      setPostingAction(false);
    }
  };

  if (loading || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-400 font-bold">Consolidating Accounts Payable records...</p>
      </div>
    );
  }

  const isMatched = invoice.status === 'MATCHED' || invoice.status === 'PENDING_APPROVAL' || invoice.status === 'APPROVED' || invoice.status === 'POSTED' || invoice.status === 'PAID';
  const isMismatch = invoice.status === 'MISMATCH_DETECTED';
  const isPosted = invoice.status === 'POSTED' || invoice.status === 'PAID' || invoice.status === 'APPROVED';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header and top navigation action bars */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/invoices")}
            className="p-2 hover:bg-slate-150 rounded-xl text-slate-500 hover:text-slate-700 transition-all border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-none">AP Invoice detail Workspace</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Verify 3-way matches, resolve variances, and check general ledger journal entry details</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Action: Match verification check */}
          {(invoice.status === 'DRAFT' || isMismatch) && (
            <button
              onClick={handleRunMatchCheck}
              disabled={matchingAction}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/50 rounded-xl transition-all border border-blue-100 shadow shadow-blue-150/10"
            >
              {matchingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Re-run 3-Way Match Check
            </button>
          )}

          {/* Action: Post ledger */}
          {!isPosted && isMatched && (
            <button
              onClick={handlePostGeneralLedger}
              disabled={postingAction}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow shadow-blue-500/10"
            >
              {postingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Approve & Post Ledger
            </button>
          )}
        </div>
      </div>

      {/* Invoice Header summary panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-xs font-semibold text-slate-500">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Vendor Name</span>
          <span className="text-sm font-black text-slate-900 block">{invoice.vendor?.name}</span>
          <span className="text-[10px] text-slate-400 font-semibold block">{invoice.vendor?.contact_email}</span>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ERP Invoice Number</span>
          <span className="text-sm font-black text-slate-900 block">{invoice.invoice_number}</span>
          <span className="text-[10px] text-slate-400 font-semibold block">Ref: {invoice.vendor_invoice_number || 'N/A'}</span>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Billed Net value</span>
          <span className="text-sm font-black text-slate-900 block">₹{parseFloat(invoice.total_amount).toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 font-semibold block">GST: ₹{parseFloat(invoice.gst_amount).toFixed(2)} | TDS: ₹{parseFloat(invoice.tds_deducted).toFixed(2)}</span>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Matching Verification Status</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border mt-1 inline-block ${
            isMatched ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            isMismatch ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse' :
            'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('match')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'match' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          3-Way Match Grid Comparison
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'ledger' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Double-Entry Ledger Postings
        </button>
        <button
          onClick={() => setActiveTab('traceability')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'traceability' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Lineage Traceability Chain
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'match' && (
        <div className="space-y-6">
          {/* Side-by-Side 3-Way Match matrix */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
              <ListOrdered className="w-4.5 h-4.5 text-blue-600" /> 3-Way Verification Comparison Matrix
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Item Description</th>
                    <th className="px-4 py-3 text-center">PO Ordered Qty</th>
                    <th className="px-4 py-3 text-center bg-blue-50/20 text-blue-800">GRN Accepted Qty</th>
                    <th className="px-4 py-3 text-center bg-purple-50/20 text-purple-800">Billed Qty</th>
                    <th className="px-4 py-3 text-right">PO Unit Price</th>
                    <th className="px-4 py-3 text-right bg-purple-50/20 text-purple-800">Billed Price</th>
                    <th className="px-4 py-3 text-right">Variance Amount</th>
                    <th className="px-4 py-3 text-center">Match Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-semibold text-slate-700 bg-white">
                  {invoice.line_items.map((item: any) => {
                    const poLine = item.po_line_item;
                    const grnLine = item.grn_line_item;
                    const varAmt = parseFloat(item.variance_amount || 0);

                    // Check highlight discrepancies
                    const qtyMismatch = item.quantity_billed > (grnLine?.quantity_accepted || poLine?.quantity_received || 0);
                    const priceMismatch = parseFloat(item.unit_price) > parseFloat(poLine?.unit_price || 0);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/10">
                        <td className="px-4 py-4">
                          <span className="font-extrabold text-slate-900 block">{poLine?.item?.name || 'Item line'}</span>
                          <span className="text-[9px] text-slate-400 font-semibold block">{poLine?.item?.sku || 'SKU'}</span>
                        </td>
                        <td className="px-4 py-4 text-center">{poLine?.quantity_ordered}</td>
                        <td className="px-4 py-4 text-center bg-blue-50/10 text-blue-800">
                          {grnLine?.quantity_accepted ?? poLine?.quantity_received}
                        </td>
                        <td className={`px-4 py-4 text-center bg-purple-50/10 font-bold ${
                          qtyMismatch ? 'text-rose-600 bg-rose-50/30' : 'text-purple-800'
                        }`}>
                          {item.quantity_billed}
                        </td>
                        <td className="px-4 py-4 text-right">₹{parseFloat(poLine?.unit_price || 0).toFixed(2)}</td>
                        <td className={`px-4 py-4 text-right bg-purple-50/10 font-bold ${
                          priceMismatch ? 'text-rose-600 bg-rose-50/30' : 'text-slate-800'
                        }`}>
                          ₹{parseFloat(item.unit_price).toFixed(2)}
                        </td>
                        <td className={`px-4 py-4 text-right font-black ${
                          varAmt > 0 ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          {varAmt > 0 ? `+₹${varAmt.toFixed(2)}` : `₹${varAmt.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                            item.match_status === 'MATCHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {item.match_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Variance resolution console if mismatch exists */}
          {isMismatch && (
            <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm space-y-4">
              <div className="border-b border-rose-50 pb-2.5 flex items-center gap-1.5 text-rose-750 font-extrabold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" /> AP Mismatch Exception Resolutions
              </div>

              <div className="space-y-4 text-xs font-semibold text-slate-500">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Configure overrides for mismatched line accounts:</span>

                <div className="space-y-3">
                  {invoice.line_items.filter((l: any) => l.match_status === 'MISMATCH_DETECTED').map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between border-b border-slate-100 pb-2 gap-4">
                      <div>
                        <span className="font-extrabold text-slate-900 block">{item.po_line_item?.item?.name}</span>
                        <span className="text-[9px] text-slate-400 font-semibold block">Billed: {item.quantity_billed} @ ₹{parseFloat(item.unit_price).toFixed(2)} vs PO: {item.po_line_item?.quantity_ordered} @ ₹{parseFloat(item.po_line_item?.unit_price).toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold">Action:</span>
                        <select
                          value={resolutions[item.id] || "APPROVED"}
                          onChange={(e) => setResolutions(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white text-slate-800 font-bold"
                        >
                          <option value="APPROVED">Manually Override & Approve</option>
                          <option value="REJECTED">Reject / Short-pay invoice</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-50">
                  <button
                    onClick={handleResolveVariance}
                    disabled={resolvingAction}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md shadow-rose-600/10"
                  >
                    {resolvingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Submit Variance Override Decisions
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Double-Entry Ledgers */}
      {activeTab === 'ledger' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
            <Landmark className="w-4.5 h-4.5 text-blue-600" /> Double-Entry Accrual Ledger Reconciliations
          </h3>

          {!isPosted ? (
            <div className="text-center py-12 text-slate-400">
              <Landmark className="w-12 h-12 text-slate-350 mx-auto mb-2" />
              <span>Invoice has not been posted to General Ledger accounts yet. Click "Approve & Post Ledger" above.</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">Open the "Double-Entry Ledgers" explorer sidebar inside your Finance & AP folder to audit detailed balanced voucher transactions logged under reference: {invoice.invoice_number}.</p>
          )}
        </div>
      )}

      {/* Tab: Lineage Traceability Chain */}
      {activeTab === 'traceability' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Lineage Traceability Pipeline</h3>

          {lineage ? (
            <div className="relative border-l border-blue-150 pl-5 ml-4 space-y-6 text-xs font-semibold text-slate-500">
              {lineage.ancestors?.map((ancestor: any, idx: number) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white" />
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{ancestor.type}</span>
                  <span className="text-slate-800 font-bold block mt-0.5">{ancestor.number || ancestor.id}</span>
                </div>
              ))}

              <div className="relative">
                <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 border-2 border-white" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">INVOICE</span>
                <span className="text-slate-800 font-black block mt-0.5">{invoice.invoice_number}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">Traceability timeline consolidating ancestor linkages...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailWorkspace;
