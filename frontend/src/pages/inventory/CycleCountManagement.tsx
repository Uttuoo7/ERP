import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, CheckCircle, XCircle, Clock, Save,
  Building, RefreshCw, ClipboardCheck, Edit3, Eye, Calendar, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWarehouses, getItems, get, post, put } from "../../api";

interface CycleCountLine {
  id: string;
  cycle_count_id: string;
  item_id: string;
  system_qty: number;
  physical_qty: number | null;
  variance_qty: number | null;
  unit_cost: number;
}

interface CycleCount {
  id: string;
  count_number: string;
  warehouse_id: string;
  status: string;
  count_date: string;
  remarks: string | null;
  created_by_id: string;
  created_at: string;
  counted_by_id: string | null;
  verified_by_id: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  lines: CycleCountLine[];
}

const CycleCountManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  
  // Modals & Active View
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCount, setActiveCount] = useState<CycleCount | null>(null);
  const [isEditingCounts, setIsEditingCounts] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");

  // Create Form Fields
  const [warehouseId, setWarehouseId] = useState("");
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState("");

  // Counts Entry Form State (line.id -> quantity)
  const [physicalQtys, setPhysicalQtys] = useState<Record<string, number>>({});

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      const res = await get("/inventory/cycle-counts", { params });
      setCounts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [statusFilter, warehouseFilter]);

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const whRes = await getWarehouses();
        setWarehouses(whRes.data);
        
        const itemRes = await getItems();
        setItems(itemRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMasters();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      toast.error("Please select a target warehouse zone.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        warehouse_id: warehouseId,
        count_date: new Date(countDate).toISOString(),
        remarks: remarks.trim() || null
      };

      await post("/inventory/cycle-counts", payload);
      toast.success("Cycle count sheet created in DRAFT!");
      setShowCreateModal(false);
      resetForm();
      fetchCounts();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setWarehouseId("");
    setCountDate(new Date().toISOString().split('T')[0]);
    setRemarks("");
  };

  const startCountsEntry = (cc: CycleCount) => {
    setActiveCount(cc);
    const qtys: Record<string, number> = {};
    cc.lines.forEach(l => {
      qtys[l.id] = l.physical_qty !== null ? l.physical_qty : l.system_qty;
    });
    setPhysicalQtys(qtys);
    setIsEditingCounts(true);
  };

  const handleCountsEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCount) return;

    setSaving(true);
    try {
      // Map back to List[CycleCountLineEntry]
      const payload = Object.keys(physicalQtys).map(lineId => ({
        id: lineId,
        physical_qty: Number(physicalQtys[lineId])
      }));

      await put(`/inventory/cycle-counts/${activeCount.id}/entry`, payload);
      toast.success("Counts sheet variance submitted successfully!");
      setIsEditingCounts(false);
      setActiveCount(null);
      fetchCounts();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await post(`/inventory/cycle-counts/${id}/approve`);
      toast.success("Cycle count approved! Stock ledger re-balanced and GL postings resolved.");
      fetchCounts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await post(`/inventory/cycle-counts/${id}/reject`);
      toast.success("Cycle count cancelled.");
      fetchCounts();
    } catch (err) {
      console.error(err);
    }
  };

  const getWarehouseName = (id: string) => {
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : "Unknown Warehouse";
  };

  const getItemSku = (id: string) => {
    const it = items.find(i => i.id === id);
    return it ? it.sku : "Unknown SKU";
  };

  const getItemName = (id: string) => {
    const it = items.find(i => i.id === id);
    return it ? it.name : "Unknown Product Name";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-250 flex items-center gap-1 w-max"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>;
      case "PENDING_APPROVAL":
        return <span className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 rounded-full border border-amber-250 flex items-center gap-1 w-max"><Clock className="w-3.5 h-3.5" /> Counted</span>;
      case "CANCELLED":
        return <span className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 rounded-full border border-rose-250 flex items-center gap-1 w-max"><XCircle className="w-3.5 h-3.5" /> Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-full border border-slate-250 flex items-center gap-1 w-max"><Clock className="w-3.5 h-3.5" /> Draft</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-none">Cycle Counting & Audits</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Conduct regular physical stock audits, calculate variances, and approve inventory adjustments</p>
          </div>
        </div>

        {!isEditingCounts && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Initialize Count Sheet
          </button>
        )}
      </div>

      {!isEditingCounts ? (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Audits</span>
              <h3 className="text-xl font-bold text-slate-800 mt-1">{counts.length}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider font-extrabold">Draft Sheets</span>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                {counts.filter(c => c.status === "DRAFT").length}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Pending Verification</span>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                {counts.filter(c => c.status === "PENDING_APPROVAL").length}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Completed Audits</span>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                {counts.filter(c => c.status === "COMPLETED").length}
              </h3>
            </div>
          </div>

          {/* Filters card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm flex flex-wrap gap-4 items-center justify-between text-xs font-semibold">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Building className="w-4 h-4" />
                <span>Filters:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Verification</option>
                <option value="COMPLETED">Approved / Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 text-slate-700"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchCounts}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all border border-slate-200 flex items-center gap-1.5 bg-white"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Registry
            </button>
          </div>

          {/* Counts List Table */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs font-semibold">Fetching cycle count schedules...</span>
              </div>
            ) : counts.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400 text-center gap-2">
                <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">No Audits Found</span>
                <span className="text-[10px] text-slate-350 mt-1">Audit sheets initialize stock lines dynamically for warehouse locations.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                      <th className="p-4">Count Sheet Number</th>
                      <th className="p-4">Warehouse Zone</th>
                      <th className="p-4">Scheduled Date</th>
                      <th className="p-4 text-center">Items Bounded</th>
                      <th className="p-4 text-center">Variances Detected</th>
                      <th className="p-4">Remarks</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {counts.map((cc) => {
                      const varianceLines = cc.lines.filter(l => l.variance_qty !== null && l.variance_qty !== 0).length;
                      return (
                        <tr key={cc.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-extrabold text-blue-700">{cc.count_number}</td>
                          <td className="p-4 font-bold text-slate-800">{getWarehouseName(cc.warehouse_id)}</td>
                          <td className="p-4 text-slate-600">{new Date(cc.count_date).toLocaleDateString()}</td>
                          <td className="p-4 text-center font-extrabold text-slate-700">{cc.lines.length}</td>
                          <td className={`p-4 text-center font-extrabold ${varianceLines > 0 ? 'text-rose-600' : 'text-slate-450'}`}>
                            {cc.status === "DRAFT" ? (
                              <span className="text-slate-350 italic font-normal text-[10px]">Awaiting Entry</span>
                            ) : (
                              varianceLines
                            )}
                          </td>
                          <td className="p-4 text-slate-450 truncate max-w-[160px] italic font-medium">{cc.remarks || "No remarks"}</td>
                          <td className="p-4">{getStatusBadge(cc.status)}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {cc.status === "DRAFT" && (
                                <button
                                  onClick={() => startCountsEntry(cc)}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black shadow-md shadow-blue-600/10 transition-all flex items-center gap-0.5"
                                >
                                  <Edit3 className="w-3 h-3" /> Enter Counts
                                </button>
                              )}
                              {cc.status === "PENDING_APPROVAL" && (
                                <>
                                  <button
                                    onClick={() => handleApprove(cc.id)}
                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black border border-emerald-250 transition-all flex items-center gap-0.5"
                                  >
                                    Approve & Post
                                  </button>
                                  <button
                                    onClick={() => handleReject(cc.id)}
                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black border border-rose-250 transition-all"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {cc.status === "COMPLETED" && (
                                <button
                                  onClick={() => { setActiveCount(cc); }}
                                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black border border-slate-200 transition-all flex items-center gap-0.5"
                                >
                                  <Eye className="w-3 h-3" /> View Summary
                                </button>
                              )}
                              {cc.status === "CANCELLED" && (
                                <span className="text-[10px] text-slate-350 font-bold italic mr-2">Cancelled</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Completed / View Modal Summary */}
          {activeCount && !isEditingCounts && (
            <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl w-full max-w-3xl overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Audit Sheet: {activeCount.count_number}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Warehouse: {getWarehouseName(activeCount.warehouse_id)} | Status: {activeCount.status}</p>
                  </div>
                  <button onClick={() => setActiveCount(null)} className="text-slate-400 hover:text-slate-655 font-bold text-lg">&times;</button>
                </div>

                <div className="p-6 space-y-4 max-h-[380px] overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[10px] text-slate-500 font-bold">
                    <div>
                      <span className="text-slate-400 font-semibold block uppercase">Counted By</span>
                      <span className="text-slate-800 font-extrabold">{activeCount.counted_by_id ? "Staff Member" : "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block uppercase">Verified By</span>
                      <span className="text-slate-800 font-extrabold">{activeCount.verified_by_id ? "Verified" : "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block uppercase">Approved By</span>
                      <span className="text-slate-800 font-extrabold">{activeCount.approved_by_id ? "Manager" : "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block uppercase">Approved At</span>
                      <span className="text-slate-800 font-extrabold">{activeCount.approved_at ? new Date(activeCount.approved_at).toLocaleDateString() : "N/A"}</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs font-semibold text-slate-700">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black border-b border-slate-100">
                        <th className="p-3">SKU / Item</th>
                        <th className="p-3 text-right">System Qty</th>
                        <th className="p-3 text-right">Physical Qty</th>
                        <th className="p-3 text-right">Variance</th>
                        <th className="p-3 text-right">Unit Cost (₹)</th>
                        <th className="p-3 text-right">Variance Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCount.lines.map((line) => {
                        const variance = line.variance_qty ?? 0;
                        const val = Math.abs(variance) * line.unit_cost;
                        return (
                          <tr key={line.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <div className="font-extrabold text-slate-850">{getItemSku(line.item_id)}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{getItemName(line.item_id)}</div>
                            </td>
                            <td className="p-3 text-right text-slate-600 font-bold">{line.system_qty}</td>
                            <td className="p-3 text-right text-slate-700 font-extrabold">{line.physical_qty ?? "N/A"}</td>
                            <td className={`p-3 text-right font-black ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {variance === 0 ? "0" : variance > 0 ? `+${variance}` : variance}
                            </td>
                            <td className="p-3 text-right text-slate-500 font-bold">{line.unit_cost.toFixed(2)}</td>
                            <td className="p-3 text-right text-slate-800 font-black">
                              {variance === 0 ? "₹0.00" : `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setActiveCount(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-655 rounded-xl font-bold text-xs"
                  >
                    Close Summary
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Cycle Count Entries spreadsheet */
        <div className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <Edit3 className="w-5 h-5 text-blue-600 animate-pulse" /> Physical Count Entry Sheet: {activeCount?.count_number}
              </h2>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Warehouse: {getWarehouseName(activeCount?.warehouse_id || "")}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setIsEditingCounts(false); setActiveCount(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs"
              >
                Cancel Entry
              </button>
            </div>
          </div>

          <form onSubmit={handleCountsEntrySubmit} className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-wider border-b border-slate-100">
                    <th className="p-3">SKU / Product Name</th>
                    <th className="p-3 text-right">System Recorded Qty</th>
                    <th className="p-3 text-right w-36">Physical Count Qty *</th>
                    <th className="p-3 text-right">Draft Variance</th>
                    <th className="p-3 text-right">Unit cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeCount?.lines.map((line) => {
                    const currentPhys = physicalQtys[line.id] ?? 0;
                    const diff = currentPhys - line.system_qty;
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-extrabold text-slate-800">{getItemSku(line.item_id)}</div>
                          <div className="text-[10px] text-slate-400 font-medium truncate max-w-[250px]">{getItemName(line.item_id)}</div>
                        </td>
                        <td className="p-3 text-right font-extrabold text-slate-550 pr-6">{line.system_qty}</td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            required
                            min={0}
                            value={currentPhys}
                            onChange={(e) => setPhysicalQtys({
                              ...physicalQtys,
                              [line.id]: Number(e.target.value)
                            })}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-800 text-center font-extrabold bg-slate-50"
                          />
                        </td>
                        <td className={`p-3 text-right font-black ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {diff === 0 ? "0" : diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="p-3 text-right text-slate-500 font-bold">{line.unit_cost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => { setIsEditingCounts(false); setActiveCount(null); }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold shadow-md shadow-blue-600/10 flex items-center gap-1.5 text-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Submit Count Sheet
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal for Initialize Count Sheet */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" /> Initialize Count Sheet
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Loads stock items currently logged in target warehouse zone</p>
              </div>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-655 font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="p-6 space-y-4 text-xs font-semibold text-slate-500">
                {/* Target Warehouse */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Target Warehouse Zone *</label>
                  <select
                    required
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                  >
                    <option value="">-- Choose Warehouse --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Audit Scheduled Date */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Scheduled Count Date *</label>
                  <input
                    type="date"
                    required
                    value={countDate}
                    onChange={(e) => setCountDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Audit remarks</label>
                  <textarea
                    placeholder="Provide details (e.g., Monthly raw materials count sheet Q2)..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full min-h-[70px] p-3 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 resize-none font-medium"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-600 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold transition-all text-xs"
                >
                  {saving ? "Initializing..." : "Initialize Sheet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CycleCountManagement;
