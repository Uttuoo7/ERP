import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Loader2, Calendar, ClipboardList, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getStockLedger } from "../api";

interface LedgerEntry {
  id: string;
  item_id: string;
  warehouse_id: string;
  batch_id?: string;
  transaction_type: string;
  quantity_change: number;
  resulting_on_hand: number;
  valuation_unit_cost: number;
  reference_type: string;
  reference_id?: string;
  remarks?: string;
  created_at: string;
  item?: {
    sku: string;
    name: string;
  };
  warehouse?: {
    name: string;
  };
  batch?: {
    batch_number: string;
  };
}

const StockLedgerList: React.FC = () => {
  const navigate = useNavigate();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await getStockLedger({
        transaction_type: txTypeFilter || undefined
      });
      
      // Client-side search match to support fast query filter
      let filtered = res.data;
      if (search.trim()) {
        const term = search.toLowerCase().trim();
        filtered = res.data.filter((x: any) => 
          x.item?.sku.toLowerCase().includes(term) || 
          x.item?.name.toLowerCase().includes(term) ||
          x.warehouse?.name.toLowerCase().includes(term)
        );
      }
      setLedger(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [txTypeFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Chronological Stock Ledger</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Immutable chronological audit trail recording movements, cost variances, and reconciliations</p>
        </div>
      </div>

      {/* Query Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Search className="w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by SKU catalog, product name, or warehouse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLedger()}
            className="w-full bg-transparent border-none outline-none text-sm text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={txTypeFilter}
            onChange={(e) => setTxTypeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-600 outline-none"
          >
            <option value="">All Movement Types</option>
            <option value="RECEIPT">RECEIPTS (+)</option>
            <option value="ISSUE">ISSUES (-)</option>
            <option value="TRANSFER">TRANSFERS</option>
            <option value="ADJUSTMENT">ADJUSTMENTS</option>
          </select>

          <button
            onClick={fetchLedger}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-all border border-slate-100"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Ledger Table logs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold">Tracing immutable entries...</p>
          </div>
        ) : ledger.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6 gap-3">
            <ClipboardList className="w-12 h-12 text-slate-350" />
            <div>
              <p className="text-sm font-bold text-slate-900">No Ledger Movements Traced</p>
              <p className="text-xs text-slate-400 mt-1">Immutable stock trails will appear here automatically upon transactional movements.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Movement Type</th>
                  <th className="px-6 py-4">Item Catalog</th>
                  <th className="px-6 py-4">Warehouse Zone</th>
                  <th className="px-6 py-4">Batch Reference</th>
                  <th className="px-6 py-4 text-center">Change Qty</th>
                  <th className="px-6 py-4 text-center">Resulting Stock</th>
                  <th className="px-6 py-4 text-right">Valuation Cost</th>
                  <th className="px-6 py-4">Audit adjustment comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {ledger.map(entry => {
                  const isPositive = entry.quantity_change > 0;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 text-slate-400 font-medium whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          entry.transaction_type === 'RECEIPT' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                            : entry.transaction_type === 'ISSUE'
                            ? 'bg-rose-50 text-rose-700 border-rose-150'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-150'
                        }`}>
                          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          {entry.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-extrabold text-slate-800 text-sm block">{entry.item?.sku}</span>
                          <span className="text-[10px] text-slate-400 leading-relaxed block line-clamp-1">{entry.item?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-bold">
                        {entry.warehouse?.name}
                      </td>
                      <td className="px-6 py-4">
                        {entry.batch ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                            {entry.batch.batch_number}
                          </span>
                        ) : (
                          <span className="text-slate-350 font-medium">Unbatched</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-center font-black text-sm ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? `+${entry.quantity_change}` : entry.quantity_change}
                      </td>
                      <td className="px-6 py-4 text-center font-black text-slate-900 text-sm">
                        {entry.resulting_on_hand}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 font-bold">
                        ₹{parseFloat(entry.valuation_unit_cost as any || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-slate-400 max-w-[200px] font-medium leading-relaxed truncate" title={entry.remarks}>
                        {entry.remarks}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockLedgerList;
