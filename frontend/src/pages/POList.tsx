import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Search, Plus, Filter, RefreshCw, DollarSign, ShieldAlert, Award
} from 'lucide-react';
import { usePurchaseOrders } from '../hooks/queries/usePurchaseOrders';
import { DataTable } from '../components/ui/DataTable';
import { columns } from './pos/columns';

const POList: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: pos = [], isLoading, refetch } = usePurchaseOrders({
    search: search || undefined,
    status_filter: statusFilter || undefined
  });

  // KPIs
  const totalOpenCommitment = pos
    .filter((p: any) => p.status !== 'CLOSED' && p.status !== 'CANCELLED')
    .reduce((sum: number, p: any) => sum + parseFloat(p.total_amount || 0), 0);

  const openCount = pos.filter((p: any) => p.status !== 'CLOSED' && p.status !== 'CANCELLED').length;
  
  const delayedCount = pos.filter((p: any) => {
    if (p.status === 'CLOSED' || p.status === 'CANCELLED' || p.status === 'FULFILLED') return false;
    return new Date(p.expected_delivery_date) < new Date();
  }).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-blue-600 bg-blue-50 rounded-xl p-1 border border-blue-100" />
            Purchase Order Commitments
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">Review legally binding supplier orders, amendments and tracking fulfillment statuses</p>
        </div>

        <Link
          to="/pos/convert"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
        >
          <Plus className="w-4.5 h-4.5" />
          Convert Won RFQ
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Gross Open Commitments</span>
            <span className="text-2xl font-black text-slate-900">
              ₹{totalOpenCommitment.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 font-extrabold">
            ₹
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Outstanding POs Count</span>
            <span className="text-2xl font-black text-slate-900">{openCount} active orders</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Delayed Delivery Backlogs</span>
            <span className={`text-2xl font-black ${delayedCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {delayedCount} orders
            </span>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
            delayedCount > 0 
              ? 'bg-rose-50 border-rose-100 text-rose-600 animate-pulse' 
              : 'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Search className="w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refetch()}
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
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="ISSUED">ISSUED</option>
              <option value="PARTIAL_RECEIPT">PARTIAL RECEIPT</option>
              <option value="FULFILLED">FULFILLED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <button
            onClick={() => refetch()}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-all border border-slate-100"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* PO Listing */}
      {pos.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-6 gap-3">
          <Award className="w-12 h-12 text-slate-350" />
          <div>
            <p className="text-sm font-bold text-slate-900">No Purchase Orders Located</p>
            <p className="text-xs text-slate-400 mt-1">Convert winning vendor quote proposals to award formal POs.</p>
          </div>
        </div>
      ) : (
        <DataTable columns={columns} data={pos} isLoading={isLoading} />
      )}
    </div>
  );
};

export default POList;
