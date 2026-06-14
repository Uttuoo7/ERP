import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, Search, Filter, RefreshCw, FileText, Clock, ArrowRight, Loader2, DollarSign, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRequisitions, duplicateRequisition } from "../api";
import { DataContainer } from '../components/common/DataContainer';
import { useHeaderStore } from '../store/headerStore';
import { useTableDensityStore } from '../store/tableDensityStore';
import { FilterToolbar } from '../components/common/FilterToolbar';
import { TableSkeleton } from '../components/common/TableSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';

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
  const setHeader = useHeaderStore(state => state.setHeader);
  
  // Global Density
  const { density } = useTableDensityStore();
  const cellPadding = density === 'compact' ? 'px-4 py-2 text-[13px]' : 'px-6 py-4 text-sm';
  const headerPadding = density === 'compact' ? 'px-4 py-3' : 'px-6 py-4';

  useEffect(() => {
    setHeader({
      actions: (
        <Link
          to="/requisitions/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-erp-primary hover:bg-blue-800 rounded-erp transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Requisition
        </Link>
      )
    });
    return () => useHeaderStore.getState().clearHeader();
  }, [setHeader]);

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

  const totalSpend = requisitions
    .filter(pr => pr.status === 'APPROVED' || pr.status === 'FULLY_CONVERTED')
    .reduce((sum, pr) => {
      const prTotal = pr.line_items.reduce((acc, line) => acc + (parseFloat(line.estimated_price) * line.quantity), 0);
      return sum + prTotal;
    }, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <StatusBadge status="neutral" label="Draft" />;
      case "PENDING_APPROVAL":
        return <StatusBadge status="warning" label="Pending Approval" />;
      case "APPROVED":
        return <StatusBadge status="success" label="Approved" />;
      case "REJECTED":
        return <StatusBadge status="error" label="Rejected" />;
      case "FULLY_CONVERTED":
        return <StatusBadge status="info" label="Fully Converted" />;
      default:
        return <StatusBadge status="neutral" label={status} />;
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
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DataContainer className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Approved Requisitions Value</span>
            <span className="text-2xl font-black text-slate-900">₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
            <DollarSign className="w-6 h-6" />
          </div>
        </DataContainer>

        <DataContainer className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Actions</span>
            <span className="text-2xl font-black text-slate-900">
              {requisitions.filter(pr => pr.status === 'PENDING_APPROVAL').length} Requests
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </DataContainer>

        <DataContainer className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Tracked requests</span>
            <span className="text-2xl font-black text-slate-900">{requisitions.length} Items</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
            <Layers className="w-6 h-6" />
          </div>
        </DataContainer>
      </div>

      <DataContainer>
        {/* Filter and Search Bar */}
        <FilterToolbar 
          searchQuery={search} 
          onSearchChange={setSearch} 
          searchPlaceholder="Search by Requisition ID or description..."
          onSearchSubmit={fetchPRs}
          filters={
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm bg-transparent border-none text-slate-700 outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-sm bg-transparent border-none text-slate-700 outline-none cursor-pointer ml-2"
              >
                <option value="">All Priorities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </>
          }
          actions={
            <button
              onClick={fetchPRs}
              className="p-1.5 hover:bg-slate-100 rounded-erp text-slate-500 transition-colors bg-white shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          }
        />

        {/* Main Table List */}
        {loading ? (
          <TableSkeleton columns={7} />
        ) : requisitions.length === 0 ? (
          <EmptyState 
            icon={<FileText className="w-12 h-12" />} 
            title="No Requisitions Found" 
            description="Create a new purchase requisition or adjust filters to begin." 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-erp-border shadow-sm">
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className={headerPadding}>Requisition ID</th>
                  <th className={headerPadding}>Requester</th>
                  <th className={headerPadding}>Department</th>
                  <th className={headerPadding}>Priority</th>
                  <th className={headerPadding}>Required Date</th>
                  <th className={headerPadding}>Status</th>
                  <th className={`${headerPadding} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-erp-border">
                {requisitions.map(pr => (
                  <tr key={pr.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className={cellPadding}>
                      <Link to={`/requisitions/${pr.id}`} className="font-bold text-erp-primary hover:text-blue-700">
                        {pr.pr_number}
                      </Link>
                    </td>
                    <td className={`${cellPadding} font-medium text-slate-700`}>
                      {pr.requester.first_name} {pr.requester.last_name}
                    </td>
                    <td className={`${cellPadding} text-slate-500`}>
                      {pr.department?.name || 'N/A'}
                    </td>
                    <td className={cellPadding}>
                      {getPriorityBadge(pr.priority)}
                    </td>
                    <td className={`${cellPadding} text-slate-500 font-medium`}>
                      {new Date(pr.required_date).toLocaleDateString()}
                    </td>
                    <td className={cellPadding}>
                      {getStatusBadge(pr.status)}
                    </td>
                    <td className={`${cellPadding} text-right space-x-2`}>
                      <button
                        onClick={() => handleDuplicate(pr.id)}
                        className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-erp-primary hover:bg-blue-50 rounded-erp transition-colors"
                      >
                        Clone
                      </button>
                      <Link
                        to={`/requisitions/${pr.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-erp-primary hover:text-blue-700 hover:bg-blue-50 rounded-erp transition-colors"
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
      </DataContainer>
    </div>
  );
};

export default PRList;
