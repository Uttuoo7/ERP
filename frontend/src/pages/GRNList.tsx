import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, Search, ShieldCheck, RefreshCw, Loader2, ArrowRight, Truck, Eye, ShieldAlert, Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getGRNs } from "../api";

interface GRNHeader {
  id: string;
  grn_number: string;
  po_id: string;
  delivery_challan_number: string;
  vehicle_details?: string;
  receipt_date: string;
  status: string;
  remarks?: string;
  purchase_order?: {
    po_number: string;
  };
  vendor?: {
    name: string;
  };
  warehouse?: {
    name: string;
  };
  received_by?: {
    email: string;
  };
}

const GRNList: React.FC = () => {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<GRNHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchGRNs = async () => {
    setLoading(true);
    try {
      const res = await getGRNs({
        status_filter: statusFilter || undefined
      });
      
      let filtered = res.data;
      if (search.trim()) {
        const term = search.toLowerCase();
        filtered = res.data.filter((x: any) => 
          x.grn_number.toLowerCase().includes(term) ||
          x.delivery_challan_number.toLowerCase().includes(term) ||
          (x.purchase_order?.po_number && x.purchase_order.po_number.toLowerCase().includes(term)) ||
          (x.vendor?.name && x.vendor.name.toLowerCase().includes(term))
        );
      }
      setGrns(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGRNs();
  }, [statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QC_PENDING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-150 animate-pulse flex items-center gap-1 w-fit">
            <ShieldAlert className="w-3 h-3" /> QC PENDING
          </span>
        );
      case 'FULLY_ACCEPTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-150 flex items-center gap-1 w-fit">
            <ShieldCheck className="w-3 h-3" /> FULLY ACCEPTED
          </span>
        );
      case 'PARTIALLY_ACCEPTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-150 flex items-center gap-1 w-fit">
            <ShieldCheck className="w-3 h-3" /> PARTIAL ACCEPT
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-150 flex items-center gap-1 w-fit">
            <ShieldAlert className="w-3 h-3" /> REJECTED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-50 text-slate-500 border border-slate-200 w-fit">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-8 h-8 text-blue-600 bg-blue-50 rounded-xl p-1 border border-blue-100" />
            Goods Receipt Notes (GRN)
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">Warehouse receiving dock, delivery challan tracking, and quality inspections</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/pos"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
          >
            <ClipboardCheck className="w-4.5 h-4.5" />
            Convert PO to GRN
          </Link>
        </div>
      </div>

      {/* Query Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Search className="w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by GRN #, Challan #, PO #, or Vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchGRNs()}
            className="w-full bg-transparent border-none outline-none text-sm text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-600 outline-none"
          >
            <option value="">All Receiving Statuses</option>
            <option value="QC_PENDING">QC PENDING</option>
            <option value="FULLY_ACCEPTED">FULLY ACCEPTED</option>
            <option value="PARTIALLY_ACCEPTED">PARTIALLY ACCEPTED</option>
            <option value="REJECTED">REJECTED</option>
          </select>

          <button
            onClick={fetchGRNs}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-all border border-slate-100"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Receipt Registry Data Grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold">Scanning dock registries...</p>
          </div>
        ) : grns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6 gap-3">
            <Inbox className="w-12 h-12 text-slate-350" />
            <div>
              <p className="text-sm font-bold text-slate-900">No Receipt Logs Found</p>
              <p className="text-xs text-slate-400 mt-1">Convert approved purchase orders to goods receipts to log inventory arrivals.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">GRN Identifier</th>
                  <th className="px-6 py-4">Receipt Date</th>
                  <th className="px-6 py-4">Linked PO</th>
                  <th className="px-6 py-4">Vendor Partner</th>
                  <th className="px-6 py-4">Warehouse Zone</th>
                  <th className="px-6 py-4">Delivery Challan</th>
                  <th className="px-6 py-4">Receiver</th>
                  <th className="px-6 py-4">Inspection Gate</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {grns.map(grn => (
                  <tr key={grn.id} className="hover:bg-slate-50/40">
                    <td className="px-6 py-4">
                      <span className="font-extrabold text-blue-600 text-sm block">{grn.grn_number}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-medium whitespace-nowrap">
                      {new Date(grn.receipt_date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-bold">
                      {grn.purchase_order?.po_number}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {grn.vendor?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {grn.warehouse?.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                        {grn.delivery_challan_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-medium">
                      {grn.received_by?.email}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(grn.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/grns/${grn.id}`}
                          className="p-1.5 hover:bg-slate-150 rounded-lg text-slate-500 hover:text-slate-700 transition-all border border-slate-100 bg-white"
                          title="View Details & Linages"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {grn.status === 'QC_PENDING' && (
                          <Link
                            to={`/grns/${grn.id}/qc`}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-all shadow-sm shadow-amber-500/10"
                            title="Inspect Quality"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> QC INSPECT
                          </Link>
                        )}
                      </div>
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

export default GRNList;
