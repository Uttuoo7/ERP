import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Search, Filter, Calendar, BookOpen,
  ArrowUpRight, ArrowDownRight, RefreshCw, FileText, Database, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getItems, getWarehouses, get } from "../../api";

interface MovementLedgerItem {
  id: string;
  item_id: string;
  sku: string;
  item_name: string;
  warehouse_id: string;
  warehouse_name: string;
  transaction_type: string;
  quantity_change: number;
  unit_cost: number;
  total_value: number;
  running_quantity_balance: number;
  running_valuation_balance: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

const InventoryTransactionLedger: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ledgerItems, setLedgerItems] = useState<MovementLedgerItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Search & Filter Parameters
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const limit = 25;

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params: any = {
        skip: (page - 1) * limit,
        limit: limit
      };
      if (itemId) params.item_id = itemId;
      if (warehouseId) params.warehouse_id = warehouseId;
      if (startDate) params.start_date = new Date(startDate).toISOString();
      if (endDate) params.end_date = new Date(endDate).toISOString();

      const res = await get("/inventory/movement-ledger", { params });
      setLedgerItems(res.data.items);
      setTotalCount(res.data.total_count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [page, itemId, warehouseId, startDate, endDate]);

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

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "RECEIPT":
      case "FINISHED_GOODS_RECEIPT":
      case "FOUND":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "ISSUE":
      case "PRODUCTION_CONSUMPTION":
      case "SHRINKAGE":
      case "WRITE_OFF":
        return "text-rose-700 bg-rose-50 border-rose-200";
      case "TRANSFER":
        return "text-indigo-700 bg-indigo-50 border-indigo-200";
      case "REVALUATION":
        return "text-amber-700 bg-amber-50 border-amber-200";
      default:
        return "text-slate-700 bg-slate-50 border-slate-200";
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

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
            <h1 className="text-2xl font-black text-slate-900 leading-none">Canonical Inventory Ledger</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Single source of truth movement ledger tracking all receipts, issues, revaluations, transfers, and count adjustments</p>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4 text-xs font-semibold text-slate-500">
        <div className="flex items-center gap-1.5 text-slate-900 font-extrabold uppercase tracking-widest text-[10px]">
          <Filter className="w-4 h-4 text-blue-600" /> Advanced Subledger Query
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Item filter */}
          <div className="space-y-1.5">
            <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Catalog SKU Product</label>
            <select
              value={itemId}
              onChange={(e) => { setItemId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
            >
              <option value="">-- All Products --</option>
              {items.map(it => (
                <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>
              ))}
            </select>
          </div>

          {/* Warehouse filter */}
          <div className="space-y-1.5">
            <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Warehouse Zone</label>
            <select
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
            >
              <option value="">-- All Warehouses --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="block text-slate-400 uppercase tracking-wider text-[10px]">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-semibold"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="block text-slate-400 uppercase tracking-wider text-[10px]">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-semibold"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-50 pt-4">
          <button
            onClick={() => {
              setItemId("");
              setWarehouseId("");
              setStartDate("");
              setEndDate("");
              setPage(1);
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Clear Filters
          </button>
          <button
            onClick={fetchLedger}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl transition-all flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Execute Query
          </button>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-semibold">Traversing canonical ledger records...</span>
          </div>
        ) : ledgerItems.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 text-center gap-2">
            <BookOpen className="w-10 h-10 text-slate-350 mx-auto" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ledger Empty</span>
            <span className="text-[10px] text-slate-350 mt-1">No transaction records found matching the query bounds.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">SKU / Item</th>
                  <th className="p-4">Warehouse</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Qty Change</th>
                  <th className="p-4 text-right">Unit Cost (₹)</th>
                  <th className="p-4 text-right">Total Value (₹)</th>
                  <th className="p-4 text-right">Running Qty</th>
                  <th className="p-4 text-right">Running Value (₹)</th>
                  <th className="p-4">Reference Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-slate-400 font-medium">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-extrabold text-slate-800">{item.sku}</div>
                      <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[180px]">{item.item_name}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-800">{item.warehouse_name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded border ${getTransactionTypeColor(item.transaction_type)}`}>
                        {item.transaction_type}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-extrabold ${item.quantity_change > 0 ? 'text-emerald-600' : item.quantity_change < 0 ? 'text-rose-600' : 'text-slate-450'}`}>
                      {item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}
                    </td>
                    <td className="p-4 text-right text-slate-500 font-bold">
                      {item.unit_cost.toFixed(2)}
                    </td>
                    <td className={`p-4 text-right font-extrabold ${item.total_value > 0 ? 'text-emerald-600' : item.total_value < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {item.total_value > 0 ? `+${item.total_value.toFixed(2)}` : item.total_value.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-800">{item.running_quantity_balance}</td>
                    <td className="p-4 text-right font-extrabold text-slate-900">
                      {item.running_valuation_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {item.reference_type ? (
                        <div className="flex flex-col">
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-slate-100 text-slate-600 rounded border border-slate-200 w-max">
                            {item.reference_type}
                          </span>
                          <span className="text-[9px] text-slate-350 font-medium truncate max-w-[100px] mt-0.5">{item.reference_id}</span>
                        </div>
                      ) : (
                        <span className="text-slate-350 italic font-medium">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <div>
              Showing Page {page} of {totalPages} ({totalCount} total movements)
            </div>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryTransactionLedger;
