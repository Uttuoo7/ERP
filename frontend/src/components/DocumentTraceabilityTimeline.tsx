import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitCommit, ArrowRight, ArrowLeft, RefreshCw, FileText, CheckCircle, Clock, XCircle, ArrowUpRight, Loader2
} from 'lucide-react';
import { getDocumentLineage } from "../api";

interface TimelineProps {
  docType: string;
  docId: string;
}

interface Node {
  id: string;
  document_number: string;
  document_type: string;
  status: string;
  created_at: string;
  creator_name: string;
  estimated_amount: number;
}

interface Relationship {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship_type: string;
  created_at: string;
}

const DocumentTraceabilityTimeline: React.FC<TimelineProps> = ({ docType, docId }) => {
  const navigate = useNavigate();
  const [lineage, setLineage] = useState<{
    source_node: Node;
    parents: Relationship[];
    children: Relationship[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLineage = async () => {
    setLoading(true);
    try {
      const res = await getDocumentLineage(docType, docId);
      setLineage(res.data);
    } catch (err) {
      console.error("Error loading document lineage:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (docId) {
      fetchLineage();
    }
  }, [docType, docId]);

  const handleNodeClick = (type: string, id: string) => {
    switch (type) {
      case "PURCHASE_REQUISITION":
        navigate(`/requisitions/${id}`);
        break;
      case "PURCHASE_ORDER":
        navigate(`/pos/${id}`);
        break;
      case "INTERNAL_SALES_ORDER":
        navigate(`/sales-orders/${id}`);
        break;
      default:
        // Other modules drill downs
        break;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "ISSUED":
      case "RECEIVED":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">Approved</span>;
      case "PENDING_APPROVAL":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">Pending</span>;
      case "DRAFT":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">Draft</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-600">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-2" />
        <span className="text-xs text-slate-400 font-semibold">Traversing lineage graph...</span>
      </div>
    );
  }

  if (!lineage) {
    return null;
  }

  const { source_node, parents, children } = lineage;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <GitCommit className="w-4.5 h-4.5 text-blue-600 rotate-90" />
          Polymorphic Lineage Trails
        </h3>
        <button
          onClick={fetchLineage}
          className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-slate-700 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-xs">
        {/* Left Column: Parents (Upstream Ancestors) */}
        <div className="space-y-3">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center md:text-left mb-2 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3 text-slate-400" /> Upstream Mappings
          </span>
          {parents.length === 0 ? (
            <div className="p-4 bg-slate-50/50 text-center rounded-xl border border-slate-100 text-[11px] text-slate-400 font-semibold">
              Primary Origin Node
            </div>
          ) : (
            parents.map((rel) => (
              <button
                key={rel.id}
                onClick={() => handleNodeClick(rel.source_type, rel.source_id)}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-150 transition-all text-left flex flex-col gap-1 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider">
                    {rel.source_type.replace("_", " ")}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400" />
                </div>
                <span className="font-extrabold text-blue-600">{rel.source_type.substring(0, 4)}-{rel.source_id.substring(0, 6).toUpperCase()}</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1">
                  Type: {rel.relationship_type}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Center Column: Source Document (Current Node) */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-full p-4.5 bg-blue-50/50 border border-blue-200/80 rounded-2xl text-center space-y-1.5 shadow-sm">
            <span className="inline-block px-2 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-700 uppercase tracking-widest mb-1">
              Active Focus
            </span>
            <h4 className="font-extrabold text-slate-900 leading-none">{source_node.document_number}</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              {source_node.document_type.replace("_", " ")}
            </p>
            <div className="pt-2 flex items-center justify-center gap-1.5">
              {getStatusBadge(source_node.status)}
              {source_node.estimated_amount > 0 && (
                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                  ₹{source_node.estimated_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Children (Downstream Descendants) */}
        <div className="space-y-3">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center md:text-right mb-2 flex items-center justify-center md:justify-end gap-1">
            Downstream Mappings <ArrowRight className="w-3 h-3 text-slate-400" />
          </span>
          {children.length === 0 ? (
            <div className="p-4 bg-slate-50/50 text-center rounded-xl border border-slate-100 text-[11px] text-slate-400 font-semibold">
              Terminating Flow Node
            </div>
          ) : (
            children.map((rel) => (
              <button
                key={rel.id}
                onClick={() => handleNodeClick(rel.target_type, rel.target_id)}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-150 transition-all text-left flex flex-col gap-1 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider">
                    {rel.target_type.replace("_", " ")}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 animate-pulse" />
                </div>
                <span className="font-extrabold text-blue-600">{rel.target_type.substring(0, 4)}-{rel.target_id.substring(0, 6).toUpperCase()}</span>
                <span className="text-[10px] text-slate-400 font-semibold mt-1">
                  Type: {rel.relationship_type}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentTraceabilityTimeline;
