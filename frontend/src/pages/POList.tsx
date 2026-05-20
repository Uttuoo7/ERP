import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Search, Plus, Filter, RefreshCw, Clock, CheckCircle, HelpCircle, ArrowRight, Loader2, DollarSign, ShieldAlert, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getPOs } from '../api';

interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  expected_delivery_date: string;
  status: string;
  workflow_state: string;
  amendment_version: number;
  total_amount: number;
  vendor?: {
    name: string;
  };
  department?: {
    name: string;
  };
}

const POList: React.FC = () => {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const res = await getPOs({
        search: search || undefined,
        status_filter: statusFilter || undefined
      });
      setPos(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case "PENDING_APPROVAL":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-150 animate-pulse">Awaiting Approval</span>;
      case "APPROVED":
      case "ISSUED":
      case "SENT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-150">Issued / Sent</span>;
      case "PARTIAL_RECEIPT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-150">Partially Received</span>;
      case "FULFILLED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">Fulfilled</span>;
      case "CLOSED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-150 text-gray-700">{status}</span>;
    }
  };

  // KPIs
  const totalOpenCommitment = pos
    .filter(p => p.status !== 'CLOSED' && p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + parseFloat(p.total_amount as any || 0), 0);

  const openCount = pos.filter(p => p.status !== 'CLOSED' && p.status !== 'CANCELLED').length;
  
  const delayedCount = pos.filter(p => {
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
            onKeyDown={(e) => e.key === 'Enter' && fetchPOs()}
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
            onClick={fetchPOs}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-all border border-slate-100"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* PO Listing */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold">Scanning order ledgers...</p>
          </div>
        ) : pos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6 gap-3">
            <Award className="w-12 h-12 text-slate-350" />
            <div>
              <p className="text-sm font-bold text-slate-900">No Purchase Orders Located</p>
              <p className="text-xs text-slate-400 mt-1">Convert winning vendor quote proposals to award formal POs.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">PO Reference</th>
                  <th className="px-6 py-4">Vendor Partner</th>
                  <th className="px-6 py-4">Cost Area</th>
                  <th className="px-6 py-4">Expected Date</th>
                  <th className="px-6 py-4 text-right">Commitment Value</th>
                  <th className="px-6 py-4 text-center">Version</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {pos.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50/40">
                    <td className="px-6 py-4">
                      <Link to={`/pos/${po.id}`} className="font-extrabold text-blue-600 hover:text-blue-700">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-bold">
                      {po.vendor?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {po.department?.name || 'Central Purchasing'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {new Date(po.expected_delivery_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900 font-black">
                      ₹{parseFloat(po.total_amount as any).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                        v{po.amendment_version}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/pos/${po.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        Details <ArrowRight className="w-3.5 h-3.5" />
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

export default POList;
