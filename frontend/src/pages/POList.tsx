import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Search, Plus, Filter, RefreshCw, ShieldAlert, Award
} from 'lucide-react';
import { usePurchaseOrders } from '../hooks/queries/usePurchaseOrders';
import { DataTable } from '../components/ui/DataTable';
import { columns } from './pos/columns';
import { DataContainer } from '../components/common/DataContainer';
import { useHeaderStore } from '../store/headerStore';
import { FilterToolbar } from '../components/common/FilterToolbar';

const POList: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const setHeader = useHeaderStore(state => state.setHeader);

  useEffect(() => {
    setHeader({
      actions: (
        <Link
          to="/pos/convert"
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-erp-primary hover:bg-blue-800 rounded-erp transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Convert Won RFQ
        </Link>
      )
    });
    return () => useHeaderStore.getState().clearHeader();
  }, [setHeader]);

  const { data: pos = [], isLoading, refetch } = usePurchaseOrders({
    search: search || undefined,
    status_filter: statusFilter || undefined
  });

  const totalOpenCommitment = pos
    .filter((p: any) => p.status !== 'CLOSED' && p.status !== 'CANCELLED')
    .reduce((sum: number, p: any) => sum + parseFloat(p.total_amount || 0), 0);

  const openCount = pos.filter((p: any) => p.status !== 'CLOSED' && p.status !== 'CANCELLED').length;
  
  const delayedCount = pos.filter((p: any) => {
    if (p.status === 'CLOSED' || p.status === 'CANCELLED' || p.status === 'FULFILLED') return false;
    return new Date(p.expected_delivery_date) < new Date();
  }).length;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DataContainer className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Gross Open Commitments</span>
            <span className="text-2xl font-black text-slate-900">
              ₹{totalOpenCommitment.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 font-extrabold">
            ₹
          </div>
        </DataContainer>

        <DataContainer className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Outstanding POs Count</span>
            <span className="text-2xl font-black text-slate-900">{openCount} active orders</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
        </DataContainer>

        <DataContainer className="p-6 flex items-center justify-between">
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
        </DataContainer>
      </div>

      <DataContainer>
        {/* Filters */}
        <FilterToolbar 
          searchQuery={search} 
          onSearchChange={setSearch} 
          searchPlaceholder="Search by PO number..."
          onSearchSubmit={() => refetch()}
          filters={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-transparent border-none text-slate-700 outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="ISSUED">ISSUED</option>
              <option value="PARTIAL_RECEIPT">PARTIAL RECEIPT</option>
              <option value="FULFILLED">FULFILLED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          }
          actions={
            <button
              onClick={() => refetch()}
              className="p-1.5 hover:bg-slate-100 rounded-erp text-slate-500 transition-colors bg-white shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          }
        />

        {/* PO Listing */}
        {pos.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Award className="w-12 h-12 text-slate-300" />
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-900">No Purchase Orders Located</p>
              <p className="text-xs text-slate-500 mt-1">Convert winning vendor quote proposals to award formal POs.</p>
            </div>
          </div>
        ) : (
          <DataTable columns={columns} data={pos} isLoading={isLoading} />
        )}
      </DataContainer>
    </div>
  );
};

export default POList;
