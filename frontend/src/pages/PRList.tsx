import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, Search, Filter, RefreshCw, FileText, CheckCircle, Clock, XCircle, ArrowRight, Loader2, DollarSign, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRequisitions, duplicateRequisition } from '../api';

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
  priority: string;
  required_date: string;
  status: string;
  currency: string;
  line_items: any[];
}

const PRList: React.FC = () => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const fetchPRs = async () => {
    setLoading(true);
    try {
      const res = await getRequisitions({
        search: search || undefined,
        status_filter: statusFilter || undefined,
        priority_filter: priorityFilter || undefined
      });
      setRequisitions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, [statusFilter, priorityFilter]);

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateRequisition(id);
      toast.success("Purchase Requisition duplicated to a new Draft successfully!");
      fetchPRs();
    } catch (err) {
      // Axios interceptor will display error
    }
  };

  // KPIs
  const totalSpend = requisitions
    .filter(pr => pr.status === 'APPROVED' || pr.status === 'FULLY_CONVERTED')
    .reduce((sum, pr) => {
      const prTotal = pr.line_items.reduce((acc, line) => acc + (parseFloat(line.estimated_price) * line.quantity), 0);
      return sum + prTotal;
    }, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case "PENDING_APPROVAL":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-150 animate-pulse">Pending Approval</span>;
      case "APPROVED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">Approved</span>;
      case "REJECTED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-150">Rejected</span>;
      case "FULLY_CONVERTED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-150">Fully Converted</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <span className="text-xs font-extrabold text-rose-600">Urgent</span>;
      case "HIGH":
        return <span className="text-xs font-extrabold text-amber-600">High</span>;
      default:
        return <span className="text-xs font-semibold text-slate-500">{priority}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            Purchase Requisitions
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">Draft, manage, and track internal organization procurement requests</p>
        </div>
        
        <Link
          to="/requisitions/new"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
        >
          <Plus className="w-4.5 h-4.5" />
          Create Requisition
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Approved Requisitions Value</span>
            <span className="text-2xl font-black text-slate-900">₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Actions</span>
            <span className="text-2xl font-black text-slate-900">
              {requisitions.filter(pr => pr.status === 'PENDING_APPROVAL').length} Requests
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Tracked requests</span>
            <span className="text-2xl font-black text-slate-900">{requisitions.length} Items</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Search className="w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Requisition ID or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPRs()}
            className="w-full bg-transparent border-none outline-none text-sm text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-600"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-600"
          >
            <option value="">All Priorities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>

          <button
            onClick={fetchPRs}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-all border border-slate-100"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Main Table List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold">Loading your procurement pipeline...</p>
          </div>
        ) : requisitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6 gap-3">
            <FileText className="w-12 h-12 text-slate-350" />
            <div>
              <p className="text-sm font-bold text-slate-900">No Requisitions Found</p>
              <p className="text-xs text-slate-400 mt-1">Create a new purchase requisition or adjust filters to begin.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Requisition ID</th>
                  <th className="px-6 py-4">Requester</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Required Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requisitions.map(pr => (
                  <tr key={pr.id} className="hover:bg-slate-50/40 text-sm">
                    <td className="px-6 py-4">
                      <Link to={`/requisitions/${pr.id}`} className="font-extrabold text-blue-600 hover:text-blue-700">
                        {pr.pr_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {pr.requester.first_name} {pr.requester.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-semibold">
                      {pr.department?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {getPriorityBadge(pr.priority)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {new Date(pr.required_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(pr.status)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleDuplicate(pr.id)}
                        className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all"
                      >
                        Clone
                      </button>
                      <Link
                        to={`/requisitions/${pr.id}`}
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

export default PRList;
