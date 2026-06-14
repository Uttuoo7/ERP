import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Search, Filter, RefreshCw, FileSpreadsheet,
  Building, Calendar, Layers, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { get, getItems, getWarehouses } from '../../api';

interface LedgerLine {
  id: string;
  transaction_number: string | null;
  transaction_type: string | null;
  item_id: string;
  sku: string;
  item_name: string;
  warehouse_name: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  created_at: string;
  reference_type: string | null;
  reference_id: string | null;
}

export const InventoryLedger: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<LedgerLine[]>([]);

  // Master Data & Filters
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params: any = {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate + 'T23:59:59').toISOString()
      };
      if (selectedItemId) params.item_id = selectedItemId;
      if (selectedWarehouseId) params.warehouse_id = selectedWarehouseId;

      const res = await get('/inventory/ledger', { params });
      setLines(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load inventory ledger report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [startDate, endDate, selectedItemId, selectedWarehouseId]);

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const itemRes = await getItems();
        setItems(itemRes.data || []);
        const whRes = await getWarehouses();
        setWarehouses(whRes.data || []);
      } catch (err) {
        console.error("Failed to load masters", err);
      }
    };
    fetchMasters();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen text-xs font-semibold text-slate-650">
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
            <h1 className="text-2xl font-black text-slate-900 leading-none">Inventory Ledger</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Audit log of all stock movements, receipts, issues, adjustments, and revaluations</p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-semibold"
              />
            </div>
          </div>

          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-semibold"
              />
            </div>
          </div>

          <div className="flex-1 min-w-[220px] space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Product SKU Filter</label>
            <div className="relative">
              <Tag className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-semibold text-slate-700"
              >
                <option value="">All Products</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 min-w-[220px] space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Warehouse zone</label>
            <div className="relative">
              <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-semibold text-slate-700"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={fetchLedger}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 h-9"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Ledger Table Card */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-semibold">Generating audit report...</span>
          </div>
        ) : lines.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2 text-center">
            <Layers className="w-10 h-10 text-slate-300 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-450">No Ledger Logs</span>
            <span className="text-[10px] text-slate-355 mt-1">No stock movement transactions fall within this configuration.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                  <th className="p-4">Transaction Date</th>
                  <th className="p-4">Transaction Number</th>
                  <th className="p-4">SKU / Item Name</th>
                  <th className="p-4">Warehouse</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Qty Change</th>
                  <th className="p-4 text-right">Unit Cost (₹)</th>
                  <th className="p-4 text-right">Total Value (₹)</th>
                  <th className="p-4">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-slate-500">{new Date(line.created_at).toLocaleString()}</td>
                    <td className="p-4 font-mono font-bold text-slate-800">{line.transaction_number || 'N/A'}</td>
                    <td className="p-4">
                      <div className="font-extrabold text-slate-800">{line.sku}</div>
                      <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[200px]">{line.item_name}</div>
                    </td>
                    <td className="p-4 text-slate-650 font-bold">{line.warehouse_name || 'N/A'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-slate-150 text-slate-700 rounded">
                        {line.transaction_type}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-extrabold ${line.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {line.quantity > 0 ? `+${line.quantity.toFixed(4)}` : line.quantity.toFixed(4)}
                    </td>
                    <td className="p-4 text-right text-slate-600 font-bold">₹{line.unit_cost.toFixed(2)}</td>
                    <td className="p-4 text-right font-extrabold text-slate-900">₹{line.total_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-4">
                      {line.reference_type ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-slate-500 bg-slate-100 rounded border border-slate-200">
                          {line.reference_type}
                        </span>
                      ) : 'N/A'}
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
