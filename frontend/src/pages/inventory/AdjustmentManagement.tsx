import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, CheckCircle, XCircle, Clock, Search, Filter,
  TrendingUp, RefreshCw, FileSpreadsheet, Building2, Tag, ShieldCheck, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getItems, getWarehouses, get, post } from "../../api";

interface Adjustment {
  id: string;
  item_id: string;
  warehouse_id: string | null;
  qty_change: number;
  unit_cost: number;
  status: string;
  reason_code: string | null;
  remarks: string | null;
  created_by_id: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

const REASON_CODES = [
  { value: "CYCLE_COUNT_VAR", label: "Cycle Count Variance" },
  { value: "DAMAGED", label: "Damaged / Spoiled Inventory" },
  { value: "SHRINKAGE", label: "Shrinkage / Theft" },
  { value: "FOUND", label: "Found Inventory" },
  { value: "WRITE_OFF", label: "Write-off / Obsolescence" },
  { value: "CORRECTION", label: "Data Entry Correction" }
];

const AdjustmentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");

  // New Form Fields
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [qtyChange, setQtyChange] = useState<number | "">("");
  const [unitCost, setUnitCost] = useState<number | "">("");
  const [reasonCode, setReasonCode] = useState("CYCLE_COUNT_VAR");
  const [remarks, setRemarks] = useState("");

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      const res = await get("/inventory/adjustments", { params });
      setAdjustments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, [statusFilter, warehouseFilter]);

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const itemRes = await getItems();
        setItems(itemRes.data);

        const whRes = await getWarehouses();
        setWarehouses(whRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMasters();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || qtyChange === "" || unitCost === "") {
      toast.error("Please supply all required adjustment fields.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        item_id: itemId,
        warehouse_id: warehouseId || null,
        qty_change: Number(qtyChange),
        unit_cost: Number(unitCost),
        reason_code: reasonCode,
        remarks: remarks.trim() || null
      };

      await post("/inventory/adjustments", payload);
      toast.success("Adjustment proposed in DRAFT state!");
      setShowCreateModal(false);
      resetForm();
      fetchAdjustments();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await post(`/inventory/adjustments/${id}/submit`);
      toast.success("Adjustment submitted for approval!");
      fetchAdjustments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await post(`/inventory/adjustments/${id}/approve`);
      toast.success("Adjustment approved! GL entries posted and subledger updated.");
      fetchAdjustments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await post(`/inventory/adjustments/${id}/reject`);
      toast.success("Adjustment rejected!");
      fetchAdjustments();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setItemId("");
    setWarehouseId("");
    setQtyChange("");
    setUnitCost("");
    setReasonCode("CYCLE_COUNT_VAR");
    setRemarks("");
  };

  // Helper selectors
  const getItemSku = (id: string) => {
    const it = items.find(i => i.id === id);
    return it ? it.sku : "Unknown SKU";
  };

  const getItemName = (id: string) => {
    const it = items.find(i => i.id === id);
    return it ? it.name : "Unknown Item";
  };

  const getWarehouseName = (id: string | null) => {
    if (!id) return "Central/Unspecified";
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : "Unknown Warehouse";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-250 flex items-center gap-1 w-max"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>;
      case "SUBMITTED":
        return <span className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 rounded-full border border-blue-250 flex items-center gap-1 w-max"><Clock className="w-3.5 h-3.5" /> Submitted</span>;
      case "REJECTED":
        return <span className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 rounded-full border border-rose-250 flex items-center gap-1 w-max"><XCircle className="w-3.5 h-3.5" /> Rejected</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-full border border-slate-250 flex items-center gap-1 w-max"><Clock className="w-3.5 h-3.5" /> Draft</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-none">Stock Adjustments Registry</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Standalone write-offs, shrinkage, found inventory corrections, and GL postings</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Propose Stock Adjustment
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider">Total Registry Entries</span>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{adjustments.length}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider">Pending Approval</span>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">
              {adjustments.filter(a => a.status === "SUBMITTED").length}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider">Total Approved Value</span>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">
              ₹{adjustments.filter(a => a.status === "APPROVED")
                .reduce((acc, curr) => acc + (Math.abs(curr.qty_change) * curr.unit_cost), 0)
                .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider font-extrabold">Total Rejected Count</span>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">
              {adjustments.filter(a => a.status === "REJECTED").length}
            </h3>
          </div>
        </div>
      </div>

      {/* Filters card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm flex flex-wrap gap-4 items-center justify-between text-xs font-semibold">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-4 h-4" />
            <span>Filters:</span>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Warehouse filter */}
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
          onClick={fetchAdjustments}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all border border-slate-200 flex items-center gap-1.5 bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reload List
        </button>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-semibold">Fetching adjustments data...</span>
          </div>
        ) : adjustments.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <HelpCircle className="w-10 h-10 text-slate-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">No Adjustments Found</span>
            <span className="text-[10px] text-slate-350 mt-1">Proposed stock adjustments will appear here.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                  <th className="p-4">SKU / Product Name</th>
                  <th className="p-4">Warehouse Zone</th>
                  <th className="p-4 text-right">Quantity Change</th>
                  <th className="p-4 text-right">Unit Cost (₹)</th>
                  <th className="p-4 text-right">Total Value (₹)</th>
                  <th className="p-4">Reason Code</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Audit Details</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.map((adj) => {
                  const val = Math.abs(adj.qty_change) * adj.unit_cost;
                  return (
                    <tr key={adj.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-extrabold text-slate-800">{getItemSku(adj.item_id)}</div>
                        <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[180px]">{getItemName(adj.item_id)}</div>
                      </td>
                      <td className="p-4 text-slate-650 font-bold">
                        {getWarehouseName(adj.warehouse_id)}
                      </td>
                      <td className={`p-4 text-right font-extrabold ${adj.qty_change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {adj.qty_change > 0 ? `+${adj.qty_change}` : adj.qty_change}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-600">
                        {adj.unit_cost.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-extrabold text-slate-800">
                        {val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 text-[10px] font-extrabold bg-slate-100 text-slate-650 rounded border border-slate-200">
                          {adj.reason_code || "N/A"}
                        </span>
                      </td>
                      <td className="p-4">{getStatusBadge(adj.status)}</td>
                      <td className="p-4">
                        <div className="text-[10px] text-slate-400 font-medium italic max-w-[150px] truncate">{adj.remarks || "No remarks"}</div>
                        <div className="text-[9px] text-slate-350 font-semibold mt-0.5">
                          {new Date(adj.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {adj.status === "DRAFT" && (
                            <button
                              onClick={() => handleSubmit(adj.id)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black border border-blue-200 transition-all"
                            >
                              Submit
                            </button>
                          )}
                          {adj.status === "SUBMITTED" && (
                            <>
                              <button
                                onClick={() => handleApprove(adj.id)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black border border-emerald-200 transition-all flex items-center gap-0.5"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(adj.id)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black border border-rose-200 transition-all"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {(adj.status === "APPROVED" || adj.status === "REJECTED") && (
                            <span className="text-[10px] text-slate-350 font-bold italic mr-2">No actions</span>
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

      {/* Modal for Propose Adjustment */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="relative bg-white rounded-3xl border border-slate-150 shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            {/* Modal header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-blue-600" /> Propose Stock Adjustment
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Logs in DRAFT state before posting double-entry entries</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-slate-450 hover:text-slate-600 transition-colors text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreate}>
              <div className="p-6 space-y-4 text-xs font-semibold text-slate-500">
                {/* Catalog SKU Product */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Catalog SKU Product *</label>
                  <select
                    required
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-semibold"
                  >
                    <option value="">-- Choose SKU Catalog --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>
                    ))}
                  </select>
                </div>

                {/* Target Warehouse Zone */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Target Warehouse Zone *</label>
                  <select
                    required
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-semibold"
                  >
                    <option value="">-- Choose Warehouse --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Quantity Change */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Quantity Change *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. +100 or -45"
                      value={qtyChange}
                      onChange={(e) => setQtyChange(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                    />
                  </div>

                  {/* Valuation Unit Cost */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Unit Cost (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 240.50"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Reason Code */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Reason Code *</label>
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-semibold"
                    >
                      {REASON_CODES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Audit Remarks *</label>
                  <textarea
                    required
                    placeholder="Provide specific reasons for auditing / adjustment (e.g. shrinkage detected during count)..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full min-h-[70px] p-3 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 resize-none font-medium"
                  />
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-slate-250 hover:bg-slate-300 text-slate-650 rounded-xl font-bold transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 text-xs"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Draft"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdjustmentManagement;
