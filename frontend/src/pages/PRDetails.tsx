import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, FileText, CheckCircle, Clock, XCircle, User, Layers, Send, Edit, RefreshCw, Loader2, MessageSquare, Plus, Check, Play
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getRequisition, submitRequisition, addRequisitionComment, getWorkflowHistory, duplicateRequisition 
} from "../api";
import { useAuth } from "../AuthContext";
import DocumentTraceabilityTimeline from '../components/DocumentTraceabilityTimeline';

interface Requisition {
  id: string;
  pr_number: string;
  requester: {
    first_name: string;
    last_name: string;
    email: string;
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
  priority: string;
  required_date: string;
  delivery_location?: {
    name: string;
  };
  currency: string;
  remarks?: string;
  status: string;
  created_at: string;
  line_items: any[];
  comments: any[];
  audits: any[];
}

const PRDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  
  const [pr, setPr] = useState<Requisition | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const prRes = await getRequisition(id!);
      setPr(prRes.data);
      
      // Load workflow engine timeline if not draft
      if (prRes.data.status !== "DRAFT") {
        const wfRes = await getWorkflowHistory(id!);
        setTimeline(wfRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleSubmitPR = async () => {
    setActioning(true);
    try {
      await submitRequisition(id!);
      toast.success("Purchase Requisition submitted to generic approval engine!");
      fetchDetails();
    } catch (err) {
      // Axios interceptor will show toast
    } finally {
      setActioning(false);
    }
  };

  const handleDuplicate = async () => {
    setActioning(true);
    try {
      await duplicateRequisition(id!);
      toast.success("Purchase Requisition cloned successfully!");
      navigate('/requisitions');
    } catch (err) {
      // Handled by interceptor
    } finally {
      setActioning(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await addRequisitionComment(id!, newComment);
      setNewComment("");
      toast.success("Comment added!");
      
      // Reload details to capture new comment thread list
      const prRes = await getRequisition(id!);
      setPr(prRes.data);
    } catch (err) {
      // Handled
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading && !pr) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Resolving requisition ledger details...</p>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-bold text-slate-900">Requisition Not Found</p>
      </div>
    );
  }

  const grossTotal = pr.line_items.reduce((sum, item) => sum + (item.quantity * parseFloat(item.estimated_price)), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case "PENDING_APPROVAL":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">Pending Approval</span>;
      case "APPROVED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-250">Approved</span>;
      case "REJECTED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-250">Rejected</span>;
      case "FULLY_CONVERTED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-250">Fully Converted</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/requisitions')}
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 leading-none">{pr.pr_number}</h1>
              {getStatusBadge(pr.status)}
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-1">Requisition request created on {new Date(pr.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pr.status === "DRAFT" && (
            <>
              <Link
                to={`/requisitions/${pr.id}/edit`}
                className="flex items-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-250 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
              >
                <Edit className="w-4 h-4" /> Edit Requisition
              </Link>

              <button
                onClick={handleSubmitPR}
                disabled={actioning}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
              >
                {actioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Submit for Approval
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={handleDuplicate}
            disabled={actioning}
            className="flex items-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-250 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            Clone/Duplicate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Header Detail Cards and line items table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Header metadata */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
              <Layers className="w-4 h-4 text-blue-600" /> Administrative Metadata
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm font-medium">
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="text-xs text-slate-400 font-bold uppercase">Requester Profile</span>
                <span className="text-slate-900 font-semibold">{pr.requester.first_name} {pr.requester.last_name} ({pr.requester.email})</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="text-xs text-slate-400 font-bold uppercase">Department Mapped</span>
                <span className="text-slate-900 font-semibold">{pr.department?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="text-xs text-slate-400 font-bold uppercase">Project Reference</span>
                <span className="text-slate-900 font-semibold">{pr.project?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="text-xs text-slate-400 font-bold uppercase">Cost Center Allocated</span>
                <span className="text-slate-900 font-semibold">{pr.cost_center?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="text-xs text-slate-400 font-bold uppercase">Target Location</span>
                <span className="text-slate-900 font-semibold">{pr.delivery_location?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="text-xs text-slate-400 font-bold uppercase">Requisition Priority</span>
                <span className="text-slate-900 font-black">{pr.priority}</span>
              </div>
            </div>

            {pr.remarks && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-semibold text-slate-500 leading-relaxed">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Header Remarks</span>
                {pr.remarks}
              </div>
            )}
          </div>

          {/* Section 2: Requisition Lines table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" /> Procurement Line Items ({pr.line_items.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-3">Catalog SKU</th>
                    <th className="px-3 py-3">Line Description</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-center">UOM</th>
                    <th className="px-3 py-3 text-right">Est. Price</th>
                    <th className="px-3 py-3 text-right">Ext. Total</th>
                    <th className="px-3 py-3">Suggested Vendor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {pr.line_items.map((line) => {
                    const price = parseFloat(line.estimated_price);
                    const extTotal = line.quantity * price;
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/20">
                        <td className="px-3 py-3.5 font-bold text-blue-600">{line.item?.sku || 'N/A'}</td>
                        <td className="px-3 py-3.5 text-slate-700">{line.description || line.item?.name}</td>
                        <td className="px-3 py-3.5 text-center font-bold text-slate-900">{line.quantity}</td>
                        <td className="px-3 py-3.5 text-center text-slate-400">{line.uom}</td>
                        <td className="px-3 py-3.5 text-right font-semibold text-slate-600">₹{price.toFixed(2)}</td>
                        <td className="px-3 py-3.5 text-right font-black text-slate-900">₹{extTotal.toFixed(2)}</td>
                        <td className="px-3 py-3.5 text-slate-500">{line.suggested_vendor?.name || 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Gross Total Spend Projection</span>
                <span className="text-xl font-black text-slate-900">₹{grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: approval timeline and commentary panel */}
        <div className="space-y-6">
          <DocumentTraceabilityTimeline docType="PURCHASE_REQUISITION" docId={id!} />
          
          {/* Section 1: Workflow Step Sequence Progress */}
          {pr.status !== "DRAFT" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Approval Workflow Track</h3>
              
              {timeline.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold py-4 text-center">Workflow initializing...</p>
              ) : (
                <div className="relative border-l border-slate-200 pl-4 space-y-5">
                  {timeline.map((history, idx) => (
                    <div key={idx} className="relative text-xs">
                      {/* Timeline circle icon */}
                      <span className="absolute -left-[21px] top-0.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm shadow-blue-500/10"></span>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 uppercase text-[9px] tracking-wider bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {history.transition_to.replace("_", " ")}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold">
                            {new Date(history.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {history.comments && (
                          <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            "{history.comments}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Requisitions Comments thread panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <MessageSquare className="w-4.5 h-4.5 text-slate-400" /> Collaboration Thread
            </h3>

            <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
              {pr.comments.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No comments logged. Share instructions or budget clarifications.</p>
              ) : (
                pr.comments.map((comment, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">{comment.user?.first_name} {comment.user?.last_name}</span>
                      <span className="text-[9px] text-slate-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-600 font-medium">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handlePostComment} className="flex gap-2 border-t border-slate-100 pt-3">
              <input
                type="text"
                required
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Post commentary or instructions..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 outline-none focus:border-blue-500 rounded-lg transition-all"
              />
              <button
                type="submit"
                disabled={submittingComment}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow shadow-blue-600/10"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PRDetails;
