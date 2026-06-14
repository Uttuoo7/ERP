import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, CheckCircle, XCircle, Clock, Trash2,
  Building, Navigation, RefreshCw, Send, CheckSquare, XSquare, PlusCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getItems, getWarehouses, get, post } from "../../api";

interface TransferLine {
  id: string;
  transfer_id: string;
  item_id: string;
  qty_requested: number;
  qty_transferred: number;
  qty_received: number;
  unit_cost: number;
}

interface Transfer {
  id: string;
  transfer_number: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  status: string;
  remarks: string | null;
  created_by_id: string;
  created_at: string;
  approved_by_id: string | null;
  approved_at: string | null;
  lines: TransferLine[];
}

const TransferManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // Modals & Sub-states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<Transfer | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  
  // Create Form Fields
  const [sourceWhId, setSourceWhId] = useState("");
  const [destWhId, setDestWhId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<Array<{ item_id: string; qty_requested: number }>>([
    { item_id: "", qty_requested: 1 }
  ]);

  // Receive Quantities Form mapping (line.id -> quantity)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source_warehouse_id = sourceFilter;
      const res = await get("/inventory/transfers", { params });
      setTransfers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [statusFilter, sourceFilter]);

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

  const handleAddLine = () => {
    setLineItems([...lineItems, { item_id: "", qty_requested: 1 }]);
  };

  const handleRemoveLine = (idx: number) => {
    const lines = [...lineItems];
    lines.splice(idx, 1);
    setLineItems(lines);
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    const lines = [...lineItems];
    lines[idx] = { ...lines[idx], [field]: val };
    setLineItems(lines);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWhId || !destWhId) {
      toast.error("Source and destination warehouses are required.");
      return;
    }
    if (sourceWhId === destWhId) {
      toast.error("Source and destination warehouses must be different.");
      return;
    }
    
    // Validate lines
    const validLines = lineItems.filter(l => l.item_id !== "" && l.qty_requested > 0);
    if (validLines.length === 0) {
      toast.error("Please add at least one line item with positive quantity.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        source_warehouse_id: sourceWhId,
        destination_warehouse_id: destWhId,
        remarks: remarks.trim() || null,
        line_items: validLines
      };

      await post("/inventory/transfers", payload);
      toast.success("Transfer proposed successfully (DRAFT)!");
      setShowCreateModal(false);
      resetForm();
      fetchTransfers();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSourceWhId("");
    setDestWhId("");
    setRemarks("");
    setLineItems([{ item_id: "", qty_requested: 1 }]);
  };

  const handleSubmit = async (id: string) => {
    try {
      await post(`/inventory/transfers/${id}/submit`);
      toast.success("Transfer request submitted for approval.");
      fetchTransfers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await post(`/inventory/transfers/${id}/approve`);
      toast.success("Transfer request approved.");
      fetchTransfers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispatch = async (id: string) => {
    try {
      await post(`/inventory/transfers/${id}/dispatch`);
      toast.success("Transfer dispatched! Stock is now in-transit.");
      fetchTransfers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await post(`/inventory/transfers/${id}/cancel`);
      toast.success("Transfer request cancelled.");
      fetchTransfers();
    } catch (err) {
      console.error(err);
    }
  };

  const openReceiveModal = (trf: Transfer) => {
    setActiveTransfer(trf);
    const initialQtys: Record<string, number> = {};
    trf.lines.forEach(l => {
      initialQtys[l.id] = l.qty_transferred; // Default to receiving everything
    });
    setReceiveQtys(initialQtys);
    setShowReceiveModal(true);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransfer) return;

    setSaving(true);
    try {
      await post(`/inventory/transfers/${activeTransfer.id}/receive`, receiveQtys);
      toast.success("Inventory received! Cost layers created at destination warehouse.");
      setShowReceiveModal(false);
      fetchTransfers();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded border border-emerald-200">Completed</span>;
      case "IN_TRANSIT":
        return <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded border border-indigo-200">In Transit</span>;
      case "APPROVED":
        return <span className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 rounded border border-blue-200">Approved</span>;
      case "PENDING_APPROVAL":
        return <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 rounded border border-amber-200">Pending Approval</span>;
      case "CANCELLED":
        return <span className="px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 rounded border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold text-slate-655 bg-slate-50 rounded border border-slate-200">Draft</span>;
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
            <h1 className="text-2xl font-black text-slate-900 leading-none">Warehouse Transfers</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Request, authorize, dispatch, track, and receive stock transfers across warehouses</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Transfer Request
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Active Requests</span>
          <h3 className="text-xl font-bold text-slate-800 mt-1">
            {transfers.filter(t => t.status !== "COMPLETED" && t.status !== "CANCELLED").length}
          </h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Pending Review</span>
          <h3 className="text-xl font-bold text-slate-800 mt-1">
            {transfers.filter(t => t.status === "PENDING_APPROVAL").length}
          </h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Dispatched / Transit</span>
          <h3 className="text-xl font-bold text-slate-800 mt-1">
            {transfers.filter(t => t.status === "IN_TRANSIT").length}
          </h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider font-extrabold">Completed Transfers</span>
          <h3 className="text-xl font-bold text-slate-800 mt-1">
            {transfers.filter(t => t.status === "COMPLETED").length}
          </h3>
        </div>
      </div>

      {/* Filters bar */}
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
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 text-slate-700"
          >
            <option value="">All Source Warehouses</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchTransfers}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all border border-slate-200 flex items-center gap-1.5 bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Registry
        </button>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-semibold">Loading transfers registry...</span>
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 text-center gap-2">
            <Navigation className="w-10 h-10 text-slate-300 mx-auto" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">No Transfers Found</span>
            <span className="text-[10px] text-slate-350 mt-1">Inter-warehouse stock requests will appear here.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                  <th className="p-4">Transfer Number</th>
                  <th className="p-4">Source Warehouse</th>
                  <th className="p-4">Destination Warehouse</th>
                  <th className="p-4 text-center">Items count</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Remarks</th>
                  <th className="p-4">Created At</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((trf) => (
                  <tr key={trf.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-extrabold text-blue-700">{trf.transfer_number}</td>
                    <td className="p-4 font-bold text-slate-800">{getWarehouseName(trf.source_warehouse_id)}</td>
                    <td className="p-4 font-bold text-slate-800">{getWarehouseName(trf.destination_warehouse_id)}</td>
                    <td className="p-4 text-center font-extrabold text-slate-600">{trf.lines.length}</td>
                    <td className="p-4">{getStatusBadge(trf.status)}</td>
                    <td className="p-4 text-slate-450 truncate max-w-[150px] font-medium italic">{trf.remarks || "No remarks"}</td>
                    <td className="p-4 text-slate-400">{new Date(trf.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {trf.status === "DRAFT" && (
                          <>
                            <button
                              onClick={() => handleSubmit(trf.id)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black border border-blue-200 transition-all"
                            >
                              Submit
                            </button>
                            <button
                              onClick={() => handleCancel(trf.id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black border border-slate-200 transition-all"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {trf.status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() => handleApprove(trf.id)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black border border-emerald-200 transition-all flex items-center gap-0.5"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleCancel(trf.id)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black border border-rose-200 transition-all"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {trf.status === "APPROVED" && (
                          <button
                            onClick={() => handleDispatch(trf.id)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black border border-indigo-200 transition-all flex items-center gap-0.5"
                          >
                            <Send className="w-3 h-3" /> Dispatch / Ship
                          </button>
                        )}
                        {trf.status === "IN_TRANSIT" && (
                          <button
                            onClick={() => openReceiveModal(trf)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-md shadow-emerald-600/10 transition-all flex items-center gap-0.5"
                          >
                            <CheckSquare className="w-3 h-3" /> Receive Stock
                          </button>
                        )}
                        {(trf.status === "COMPLETED" || trf.status === "CANCELLED") && (
                          <span className="text-[10px] text-slate-350 font-bold italic mr-2">No actions</span>
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

      {/* Modal for Create Transfer */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Navigation className="w-5 h-5 text-blue-600" /> Request Stock Transfer
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Define source, destination, and transfer line quantities</p>
              </div>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-650 font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="p-6 space-y-4 text-xs font-semibold text-slate-500 max-h-[400px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  {/* Source WH */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Source Warehouse *</label>
                    <select
                      required
                      value={sourceWhId}
                      onChange={(e) => setSourceWhId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                    >
                      <option value="">-- Select Source --</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Destination WH */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Destination Warehouse *</label>
                    <select
                      required
                      value={destWhId}
                      onChange={(e) => setDestWhId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                    >
                      <option value="">-- Select Destination --</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Transfer Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Replenishment request for Q3 project..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                  />
                </div>

                {/* Lines */}
                <div className="space-y-2 border-t border-slate-50 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-450 uppercase tracking-wider text-[10px] font-black">Lines Items To Transfer</label>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-bold text-[10px] uppercase"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add Line
                    </button>
                  </div>

                  {lineItems.map((line, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      {/* Item SKU */}
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase">Product *</label>
                        <select
                          required
                          value={line.item_id}
                          onChange={(e) => handleLineChange(idx, "item_id", e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 text-slate-700"
                        >
                          <option value="">-- Select Product --</option>
                          {items.map(it => (
                            <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Requested */}
                      <div className="w-24 space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase">Qty *</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={line.qty_requested}
                          onChange={(e) => handleLineChange(idx, "qty_requested", Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 text-slate-700 text-center"
                        />
                      </div>

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-2 text-rose-500 hover:text-rose-600 border border-slate-100 hover:bg-slate-50 rounded-lg mb-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
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
                  {saving ? "Creating..." : "Propose Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Receive Transfer */}
      {showReceiveModal && activeTransfer && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl w-full max-w-xl overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <CheckSquare className="w-5 h-5 text-emerald-600" /> Receive Transfer: {activeTransfer.transfer_number}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Verify and record actual quantities received at destination warehouse</p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleReceive}>
              <div className="p-6 space-y-4 text-xs font-semibold text-slate-550 max-h-[350px] overflow-y-auto">
                <div className="bg-amber-50/55 p-3.5 rounded-2xl border border-amber-100 text-amber-800 text-[10px] leading-relaxed font-medium">
                  Notice: Stock receipts will be generated dynamically, rebuilding FIFO cost layers in destination warehouse zone.
                </div>

                <div className="space-y-3">
                  {activeTransfer.lines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150">
                      <div>
                        <div className="font-extrabold text-slate-800">{getItemSku(line.item_id)}</div>
                        <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[220px]">
                          {getItemName(line.item_id)}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 block uppercase font-bold">Shipped</span>
                          <span className="font-extrabold text-slate-700 text-xs">{line.qty_transferred}</span>
                        </div>

                        <div className="w-24">
                          <span className="text-[9px] text-slate-450 block uppercase font-bold mb-1">Received</span>
                          <input
                            type="number"
                            required
                            min={0}
                            max={line.qty_transferred}
                            value={receiveQtys[line.id] ?? 0}
                            onChange={(e) => setReceiveQtys({
                              ...receiveQtys,
                              [line.id]: Number(e.target.value)
                            })}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg outline-none bg-white focus:border-emerald-500 text-slate-800 text-center font-extrabold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-655 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold transition-all text-xs"
                >
                  {saving ? "Saving..." : "Confirm Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TransferManagement;
