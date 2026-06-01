import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, CheckCircle, Clock, XCircle, Plus, Send, RefreshCw, Loader2, Star, Award, Sparkles, Building, ListCollapse, ChevronRight, History, Package, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getPO, getPOAmendments, submitPOForApproval, amendPO, generateDocument, getLatestDocumentUrl
} from "../api";
import DocumentTraceabilityTimeline from '../components/DocumentTraceabilityTimeline';

interface POLine {
  id: string;
  item: {
    sku: string;
    name: string;
  };
  quantity_ordered: number;
  unit_price: number;
  taxes: number;
  discounts: number;
  quantity_received: number;
  remaining_quantity: number;
  description?: string;
}

interface Amendment {
  id: string;
  amendment_number: number;
  change_reason: string;
  snapshot_data: string;
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  expected_delivery_date: string;
  payment_terms?: string;
  delivery_terms?: string;
  status: string;
  workflow_state: string;
  amendment_version: number;
  total_amount: number;
  tax_summary?: string;
  discount_summary?: string;
  vendor?: {
    name: string;
  };
  department?: {
    name: string;
  };
  project?: {
    name: string;
  };
  cost_center?: {
    name: string;
  };
  line_items: POLine[];
  amendments: Amendment[];
}

const PODetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Revisions States
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  // Amend Modal States
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [changeReason, setChangeReason] = useState("");

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await getPO(id!);
      setPo(res.data);
      
      const amendRes = await getPOAmendments(id!);
      setAmendments(amendRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  const handleSubmitApproval = async () => {
    setActioning(true);
    try {
      await submitPOForApproval(id!);
      toast.success("Purchase Order submitted for dynamic approvals routing.");
      fetchDetails();
    } catch (err) {
      // Handled
    } finally {
      setActioning(false);
    }
  };

  const handleAmendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim()) {
      toast.error("Please specify a change reason for this amendment.");
      return;
    }

    setActioning(true);
    try {
      await amendPO(id!, changeReason);
      toast.success("PO successfully amended to draft. Ready for revisions.");
      setShowAmendModal(false);
      setChangeReason("");
      fetchDetails();
    } catch (err) {
      // Handled
    } finally {
      setActioning(false);
    }
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      await generateDocument("PURCHASE_ORDER", id!);
      toast.success("PDF generation requested. You will be notified when ready.");
      
      // Setup temporary listener for the websocket completion (simplified flow)
      const handleDocReady = async (e: Event) => {
        const customEvent = e as CustomEvent;
        const payload = customEvent.detail;
        if (payload.type === 'DOCUMENT_READY' && payload.reference_id === id) {
           toast.success("Document is ready!");
           setGenerating(false);
           window.removeEventListener('NEW_NOTIFICATION', handleDocReady);
           
           // Fetch the presigned URL
           try {
             const urlRes = await getLatestDocumentUrl("PURCHASE_ORDER", id!);
             window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${urlRes.data.download_url}`, '_blank');
           } catch (err) {
             toast.error("Failed to fetch secure download URL");
           }
        }
      };
      
      window.addEventListener('NEW_NOTIFICATION', handleDocReady);
      
      // Fallback timeout in case WS fails
      setTimeout(() => {
        window.removeEventListener('NEW_NOTIFICATION', handleDocReady);
        setGenerating(false);
      }, 10000);
      
    } catch (err) {
      toast.error("Failed to request document generation.");
      setGenerating(false);
    }
  };

  const handleInspectSnapshot = (amend: Amendment) => {
    try {
      const parsed = JSON.parse(amend.snapshot_data);
      setSelectedSnapshot({
        version: amend.amendment_number,
        change_reason: amend.change_reason,
        created_at: amend.created_at,
        data: parsed
      });
    } catch (e) {
      toast.error("Failed to parse revision snap data.");
    }
  };

  if (loading && !po) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Resolving PO records...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-bold text-slate-900">Purchase Order Not Located</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case "PENDING_APPROVAL":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">Pending Approval</span>;
      case "APPROVED":
      case "ISSUED":
      case "SENT":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Issued & Committed</span>;
      case "PARTIAL_RECEIPT":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">Partially Received</span>;
      case "FULFILLED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Fully Fulfilled</span>;
      case "CLOSED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600">Closed</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  // Fulfillment progress
  const totalOrdered = po.line_items.reduce((sum, l) => sum + l.quantity_ordered, 0);
  const totalReceived = po.line_items.reduce((sum, l) => sum + l.quantity_received, 0);
  const fulfillmentRatio = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 leading-none">{po.po_number}</h1>
              {getStatusBadge(po.status)}
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                v{po.amendment_version}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-1">Vendor: <span className="font-bold text-slate-700">{po.vendor?.name}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {po.status === "DRAFT" && (
            <button
              onClick={handleSubmitApproval}
              disabled={actioning}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
            >
              {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit for Approval
            </button>
          )}

          {(po.status === "APPROVED" || po.status === "PARTIAL_RECEIPT") && (
            <button
              onClick={() => navigate(`/grns/convert?po_id=${po.id}`)}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/10"
            >
              <Package className="w-4 h-4" />
              Convert to GRN Receipt
            </button>
          )}

          {(po.status === "ISSUED" || po.status === "SENT") && (
            <button
              onClick={() => setShowAmendModal(true)}
              disabled={actioning}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/10"
            >
              <History className="w-4 h-4" />
              Amend PO
            </button>
          )}

          <button
            onClick={handleGeneratePDF}
            disabled={generating}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Official PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata logistics */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
              <ListCollapse className="w-4 h-4 text-blue-600" /> Accounting & Shipping
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Department</span>
                <span className="text-slate-800 font-bold">{po.department?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Project / Cost Center</span>
                <span className="text-slate-800 font-bold">{po.project?.name || po.cost_center?.name || 'Central Purchasing'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Payment Terms</span>
                <span className="text-slate-800 font-bold">{po.payment_terms || 'Standard'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Expected Delivery</span>
                <span className="text-slate-800 font-black">{new Date(po.expected_delivery_date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Line items details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">
              Purchase Order Line Items ({po.line_items.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-3">SKU Catalog</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 text-center">Ordered</th>
                    <th className="px-3 py-3 text-center">Received</th>
                    <th className="px-3 py-3 text-right">Unit Price</th>
                    <th className="px-3 py-3 text-right">Ext Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {po.line_items.map(line => {
                    const extVal = (line.quantity_ordered * line.unit_price) + parseFloat(line.taxes as any || 0) - parseFloat(line.discounts as any || 0);
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/20">
                        <td className="px-3 py-3.5 font-bold text-blue-600">{line.item.sku}</td>
                        <td className="px-3 py-3.5 text-slate-800">{line.item.name}</td>
                        <td className="px-3 py-3.5 text-center font-bold text-slate-900">{line.quantity_ordered}</td>
                        <td className="px-3 py-3.5 text-center text-slate-400">
                          <span className={`px-2 py-0.5 rounded font-black ${line.quantity_received > 0 ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>
                            {line.quantity_received} received
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right text-slate-500">₹{parseFloat(line.unit_price as any).toFixed(2)}</td>
                        <td className="px-3 py-3.5 text-right font-black text-slate-900">₹{extVal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  
                  {/* Totals row */}
                  <tr className="bg-slate-50/50 border-t border-slate-150">
                    <td className="px-3 py-4 font-extrabold text-sm text-slate-900" colSpan={2}>Gross Total Commitments</td>
                    <td className="px-3 py-4 text-center font-black text-slate-900">{totalOrdered}</td>
                    <td className="px-3 py-4 text-center font-black text-sky-700">{totalReceived}</td>
                    <td className="px-3 py-4 text-right" colSpan={2}>
                      <span className="text-base font-black text-blue-600">
                        ₹{parseFloat(po.total_amount as any).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery Tracker console */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Package className="w-4.5 h-4.5 text-blue-600" /> Delivery & Supplier Fulfillment Tracker
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-450">Fulfillment ratio</span>
                <span className="text-slate-900 font-black">{fulfillmentRatio.toFixed(1)}% ({totalReceived} of {totalOrdered} items received)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${fulfillmentRatio}%` }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: trace timeline & Revisions history list */}
        <div className="space-y-6">
          {/* Dynamic Trace Timeline */}
          <DocumentTraceabilityTimeline docType="PURCHASE_ORDER" docId={id!} />

          {/* Revisions History list */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
              <History className="w-4.5 h-4.5 text-slate-400" /> PO Revisions Timeline ({amendments.length})
            </h3>

            <div className="space-y-3">
              {amendments.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">This order hasn't undergone revisions yet.</p>
              ) : (
                amendments.map(amend => (
                  <div
                    key={amend.id}
                    onClick={() => handleInspectSnapshot(amend)}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-150 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-slate-900 block">Version {amend.amendment_number} snapshot</span>
                      <span className="text-[10px] text-slate-400 block font-semibold leading-relaxed line-clamp-1">{amend.change_reason}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- Amend Reason Modal --- */}
      {showAmendModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl max-w-md w-full space-y-4">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-extrabold text-slate-900">Amend Purchase Order</h3>
              <p className="text-xs text-slate-400 mt-0.5">Please specify the revision change log reason. This PO will shift back to draft and up-version.</p>
            </div>

            <form onSubmit={handleAmendSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="block text-slate-400 font-bold uppercase">Change / Amendment Reason</label>
                <textarea
                  required
                  placeholder="e.g. Quantity changes from supplier negotiations..."
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="w-full min-h-[90px] p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAmendModal(false)}
                  className="px-4 py-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200/80 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actioning}
                  className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-750 rounded-lg transition-all flex items-center gap-1"
                >
                  {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save & Amend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Snapshot detail inspector modal --- */}
      {selectedSnapshot && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">PO Snapshot - Version {selectedSnapshot.version}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Logged: {new Date(selectedSnapshot.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all"
              >
                Close Inspector
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 leading-relaxed">
                <span className="font-extrabold block">Change Reason Log</span>
                <span>{selectedSnapshot.change_reason}</span>
              </div>

              {/* Snapshot header metrics */}
              <div className="grid grid-cols-2 gap-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Original Total</span>
                  <span className="text-sm font-black text-slate-900">₹{selectedSnapshot.data.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Original Terms</span>
                  <span className="text-slate-800 font-bold">{selectedSnapshot.data.payment_terms || 'Standard'}</span>
                </div>
              </div>

              {/* Snapshot items list */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Snapshot Items Registry</span>
                <div className="space-y-2">
                  {selectedSnapshot.data.line_items.map((line: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{line.item_sku} - {line.item_name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Qty: {line.quantity_ordered} | Unit Price: ₹{line.unit_price.toFixed(2)}</span>
                      </div>
                      <span className="font-black text-slate-900">₹{(line.quantity_ordered * line.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PODetails;
