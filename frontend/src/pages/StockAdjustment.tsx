import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Save, FileText, CheckCircle, Clock, Calendar, Sparkles, Building, Layers, ClipboardCheck, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getItems, getWarehouses, adjustStock } from "../api";

const StockAdjustment: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Form Inputs
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [qtyChange, setQtyChange] = useState<number | "">("");
  const [unitCost, setUnitCost] = useState<number | "">("");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [serialText, setSerialText] = useState("");
  const [remarks, setRemarks] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !warehouseId || qtyChange === "" || unitCost === "") {
      toast.error("Please supply all required adjustment fields.");
      return;
    }

    setSaving(true);
    try {
      // Split serials by line
      const serials = serialText.split('\n')
        .map(x => x.trim())
        .filter(x => x.length > 0);

      const payload = {
        item_id: itemId,
        warehouse_id: warehouseId,
        qty_change: Number(qtyChange),
        valuation_unit_cost: Number(unitCost),
        batch_number: batchNo.trim() || null,
        expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
        serial_numbers: serials,
        remarks: remarks.trim() || null
      };

      await adjustStock(payload);
      toast.success("Inventory balance adjusted and audited in stock ledger!");
      navigate('/inventory');
    } catch (err: any) {
      // Handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Stock Adjustment Workspace</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Submit count variance reconciliations, damage write-offs, or initial stock logs</p>
        </div>
      </div>

      {/* Adjustment Form card */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6 text-xs font-semibold text-slate-500">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Catalog SKU */}
            <div className="space-y-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider">Catalog SKU Product *</label>
              <select
                required
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
              >
                <option value="">-- Choose SKU Catalog --</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div className="space-y-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider">Target Warehouse Zone *</label>
              <select
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
              >
                <option value="">-- Choose Warehouse --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quantity Change */}
            <div className="space-y-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider">Quantity Variance (+ / -) *</label>
              <input
                type="number"
                required
                placeholder="e.g. +100 or -45"
                value={qtyChange}
                onChange={(e) => setQtyChange(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
              />
              <span className="text-[10px] text-slate-400 leading-none">Use positive count for receipt corrections, negative for write-offs.</span>
            </div>

            {/* Unit Cost */}
            <div className="space-y-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider">Valuation Unit Cost (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 240.50"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
              />
            </div>
          </div>

          {/* Batch Tracking Option */}
          <div className="border-t border-slate-50 pt-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" /> Batch & Serial Lot Binds (Optional)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Batch number */}
              <div className="space-y-2">
                <label className="block text-slate-400 font-bold uppercase tracking-wider">Batch Lot Number</label>
                <input
                  type="text"
                  placeholder="e.g. LOT-2026-X4"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <label className="block text-slate-400 font-bold uppercase tracking-wider">Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                />
              </div>
            </div>

            {/* Serial Numbers List */}
            <div className="space-y-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider">Serial Numbers (One SKU identifier per line)</label>
              <textarea
                placeholder="e.g.&#10;SN-994328843&#10;SN-994328844"
                value={serialText}
                onChange={(e) => setSerialText(e.target.value)}
                className="w-full min-h-[90px] p-3 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 resize-none font-mono"
              />
            </div>
          </div>

          {/* Audit Remarks */}
          <div className="space-y-2 border-t border-slate-50 pt-5">
            <label className="block text-slate-400 font-bold uppercase tracking-wider">Reconciliation Audit Remarks *</label>
            <textarea
              required
              placeholder="Provide exact reasons for this adjustment (e.g. Write-off damaged packaging after cycle count)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full min-h-[80px] p-3 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="px-5 py-2.5 text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-250 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Adjustment
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default StockAdjustment;
