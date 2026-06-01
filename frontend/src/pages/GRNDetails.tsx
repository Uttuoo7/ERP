import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Calendar, ShieldCheck, ShieldAlert, Truck, User, Info, Building, Layers, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getGRN } from "../api";
import DocumentTraceabilityTimeline from '../components/DocumentTraceabilityTimeline';

interface GRNDetailHeader {
  id: string;
  grn_number: string;
  po_id: string;
  delivery_challan_number: string;
  vehicle_details?: string;
  receipt_date: string;
  status: string;
  workflow_state: string;
  remarks?: string;
  inspected_by_id?: string;
  inspection_date?: string;
  inspection_remarks?: string;
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
  inspected_by?: {
    email: string;
  };
  line_items: Array<{
    id: string;
    item_id: string;
    quantity_ordered: number;
    quantity_received: number;
    quantity_accepted: number;
    quantity_rejected: number;
    quantity_damaged: number;
    batch_number?: string;
    serial_numbers?: string;
    expiry_date?: string;
    warehouse_location?: string;
    inspection_remarks?: string;
    item?: {
      sku: string;
      name: string;
    };
  }>;
}

const GRNDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [grn, setGrn] = useState<GRNDetailHeader | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchGRNDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getGRN(id);
      setGrn(res.data);
    } catch (err) {
      toast.error("Failed to load Goods Receipt details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGRNDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-xs text-slate-400 font-bold">Scanning receiving details...</span>
      </div>
    );
  }

  if (!grn) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-20 text-slate-400">
        <ShieldAlert className="w-12 h-12 mx-auto text-slate-350" />
        <p className="text-sm font-bold text-slate-800 mt-2">Goods Receipt details not located.</p>
        <button onClick={() => navigate('/grns')} className="mt-4 text-xs font-bold text-blue-600">Back to Dock</button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QC_PENDING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-150 animate-pulse flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> QC PENDING
          </span>
        );
      case 'FULLY_ACCEPTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-150 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> FULLY ACCEPTED
          </span>
        );
      case 'PARTIALLY_ACCEPTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-150 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> PARTIAL ACCEPT
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-150 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> REJECTED
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-50 text-slate-500 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/grns')}
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white shadow-sm"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 leading-none">{grn.grn_number}</h1>
              {getStatusBadge(grn.status)}
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Received: {new Date(grn.receipt_date).toLocaleString()}
            </p>
          </div>
        </div>

        {grn.status === 'QC_PENDING' && (
          <Link
            to={`/grns/${grn.id}/qc`}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-md shadow-amber-500/10"
          >
            <ShieldCheck className="w-4.5 h-4.5" />
            Inspect Unloaded Goods
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Receipt Information Headers */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-3">
              <Truck className="w-4 h-4 text-blue-600" /> Receipt & Logistics details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-semibold text-slate-500">
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Linked Purchase Order</span>
                <span className="text-slate-900 font-black text-sm">{grn.purchase_order?.po_number}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Vendor Partner</span>
                <span className="text-slate-900 font-black text-sm">{grn.vendor?.name}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Destination Warehouse Zone</span>
                <span className="text-slate-900 font-bold text-sm flex items-center gap-1">
                  <Building className="w-4 h-4 text-slate-400" /> {grn.warehouse?.name}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Delivery Challan / Invoice #</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 w-fit block">
                  {grn.delivery_challan_number}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Shipping Vehicle Plate</span>
                <span className="text-slate-800 font-bold text-sm">{grn.vehicle_details || 'Unrecorded'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider">Receiving Clerk / Officer</span>
                <span className="text-slate-800 font-bold text-sm flex items-center gap-1">
                  <User className="w-4 h-4 text-slate-400" /> {grn.received_by?.email}
                </span>
              </div>
            </div>

            {grn.remarks && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1 text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-wider block">Clerk receiving remarks</span>
                <p className="text-slate-600 font-medium leading-relaxed">{grn.remarks}</p>
              </div>
            )}
          </div>

          {/* QC Inspection Audit Summary */}
          {grn.inspected_by && (
            <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100/60 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-amber-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-amber-100/60 pb-3">
                <ShieldCheck className="w-4 h-4 text-amber-600" /> Quality Control Inspection audit log
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-semibold text-amber-800">
                <div className="space-y-1">
                  <span className="text-amber-600/70 block font-bold uppercase tracking-wider">Inspector Officer</span>
                  <span className="text-amber-900 font-black text-sm">{grn.inspected_by?.email}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-amber-600/70 block font-bold uppercase tracking-wider">Inspection Timestamp</span>
                  <span className="text-amber-900 font-bold text-sm">
                    {grn.inspection_date ? new Date(grn.inspection_date).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {grn.inspection_remarks && (
                <div className="bg-white p-4 rounded-xl border border-amber-100 space-y-1 text-xs">
                  <span className="text-amber-600/70 font-bold uppercase tracking-wider block">Inspector comments</span>
                  <p className="text-amber-950 font-medium leading-relaxed">{grn.inspection_remarks}</p>
                </div>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-3">
              <Layers className="w-4 h-4 text-blue-600" /> Unloaded line counts
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-4 py-3">SKU & Item Name</th>
                    <th className="px-4 py-3 text-center">Ordered</th>
                    <th className="px-4 py-3 text-center">Received</th>
                    <th className="px-4 py-3 text-center text-emerald-600">Accepted</th>
                    <th className="px-4 py-3 text-center text-rose-600">Rejected</th>
                    <th className="px-4 py-3 text-center text-indigo-600">Damaged</th>
                    <th className="px-4 py-3">Batch & Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                  {grn.line_items.map(line => (
                    <tr key={line.id} className="hover:bg-slate-50/20">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-extrabold text-slate-800 text-sm block">{line.item?.sku}</span>
                          <span className="text-[10px] text-slate-400 block line-clamp-1">{line.item?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">{line.quantity_ordered}</td>
                      <td className="px-4 py-3 text-center text-slate-900 font-bold">{line.quantity_received}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-black">{line.quantity_accepted}</td>
                      <td className="px-4 py-3 text-center text-rose-600 font-black">{line.quantity_rejected}</td>
                      <td className="px-4 py-3 text-center text-indigo-600 font-black">{line.quantity_damaged}</td>
                      <td className="px-4 py-3">
                        {line.batch_number ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                              {line.batch_number}
                            </span>
                            {line.expiry_date && (
                              <span className="text-[9px] text-rose-500 block font-semibold">
                                Exp: {new Date(line.expiry_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-350 font-medium">Unbatched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Traceability Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 sticky top-6">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-3">
              Document Lineage Hub
            </h3>
            {id && (
              <DocumentTraceabilityTimeline
                docType="GOODS_RECEIPT_NOTE"
                docId={id}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GRNDetails;
