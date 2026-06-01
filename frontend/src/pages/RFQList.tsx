import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Search, Plus, Filter, RefreshCw, Clock, CheckCircle, HelpCircle, ArrowRight, Loader2, ListCollapse, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRFQs } from "../api";

interface RFQ {
  id: string;
  rfq_number: string;
  due_date: string;
  status: string;
  currency: string;
  buyer: {
    first_name: string;
    last_name: string;
  };
  department?: {
    name: string;
  };
  line_items: any[];
  invitations: any[];
  quotations: any[];
}

const RFQList: React.FC = () => {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchRFQs = async () => {
    setLoading(true);
    try {
      const res = await getRFQs({
        search: search || undefined,
        status_filter: statusFilter || undefined
      });
      setRfqs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRFQs();
  }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case "SENT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 animate-pulse">Sent to Vendors</span>;
      case "PARTIALLY_RESPONDED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-150 animate-pulse">Partially Responded</span>;
      case "FULLY_RESPONDED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-150">Fully Responded</span>;
      case "APPROVED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">Selection Approved</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-8 h-8 text-blue-600" />
            Request For Quotations (RFQ)
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">Coordinate multi-vendor invitations, contrast quote proposals and trigger recommendations</p>
        </div>

        <Link
          to="/rfqs/new"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
        >
          <Plus className="w-4.5 h-4.5" />
          Create RFQ from PR
        </Link>
      </div>

      {/* KPI summaries cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active evaluations</span>
            <span className="text-2xl font-black text-slate-900">
              {rfqs.filter(r => r.status === 'PARTIALLY_RESPONDED' || r.status === 'FULLY_RESPONDED').length} RFQs
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
            <ListCollapse className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Awaiting responses</span>
            <span className="text-2xl font-black text-slate-900">
              {rfqs.filter(r => r.status === 'SENT').length} suppliers queries
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Awarded / Selection Approved</span>
            <span className="text-2xl font-black text-slate-900">
              {rfqs.filter(r => r.status === 'APPROVED').length} Decisions
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Search className="w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by RFQ number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRFQs()}
            className="w-full bg-transparent border-none outline-none text-sm text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-600"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SENT">SENT</option>
              <option value="PARTIALLY_RESPONDED">PARTIALLY RESPONDED</option>
              <option value="FULLY_RESPONDED">FULLY RESPONDED</option>
              <option value="APPROVED">APPROVED</option>
            </select>
          </div>

          <button
            onClick={fetchRFQs}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-all border border-slate-100"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold">Loading RFQ registry...</p>
          </div>
        ) : rfqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6 gap-3">
            <Award className="w-12 h-12 text-slate-350" />
            <div>
              <p className="text-sm font-bold text-slate-900">No RFQs Found</p>
              <p className="text-xs text-slate-400 mt-1">Convert approved Purchase Requisitions or adjust filters to begin.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">RFQ Number</th>
                  <th className="px-6 py-4">Buyer / Agent</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4 text-center">Invited Vendors</th>
                  <th className="px-6 py-4 text-center">Responded Quotes</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rfqs.map(rfq => (
                  <tr key={rfq.id} className="hover:bg-slate-50/40">
                    <td className="px-6 py-4">
                      <Link to={`/rfqs/${rfq.id}`} className="font-extrabold text-blue-600 hover:text-blue-700">
                        {rfq.rfq_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {rfq.buyer.first_name} {rfq.buyer.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-semibold">
                      {rfq.department?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {new Date(rfq.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {rfq.invitations.length}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-0.5 rounded font-black text-xs bg-slate-100 text-slate-700 border border-slate-200">
                        {rfq.quotations.length} quotes
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(rfq.status)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        to={`/rfqs/${rfq.id}/compare`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        Compare Grid
                      </Link>
                      <Link
                        to={`/rfqs/${rfq.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RFQList;
