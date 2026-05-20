import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, Search, ShieldAlert, DollarSign, Plus, RefreshCw, Loader2, ArrowRight, ClipboardCheck, History, Package, Boxes
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getInventoryBalances, getWarehouses } from '../api';

interface WarehouseStock {
  id: string;
  warehouse_id: string;
  item_id: string;
  batch_id?: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_damaged: number;
  quantity_transit: number;
  valuation_unit_cost: number;
  item?: {
    sku: string;
    name: string;
    description?: string;
  };
  warehouse?: {
    name: string;
  };
  batch?: {
    batch_number: string;
    expiry_date?: string;
  };
}

const WarehouseDashboard: React.FC = () => {
  const [balances, setBalances] = useState<WarehouseStock[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [search, setSearch] = useState("");
  const [whFilter, setWhFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const balRes = await getInventoryBalances({
        search: search || undefined,
        warehouse_id: whFilter || undefined
      });
      setBalances(balRes.data);
      
      const whRes = await getWarehouses();
      setWarehouses(whRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [whFilter]);

  // Analytics Calculations
  const grossValuation = balances.reduce((sum, b) => sum + (b.quantity_on_hand * parseFloat(b.valuation_unit_cost as any || 0)), 0);
  const lowStockCount = balances.filter(b => b.quantity_on_hand <= 15).length;
  
  // Utilization: percentage of active warehouse allocations
  const activeWHCount = new Set(balances.map(b => b.warehouse_id)).size;
  const utilizationRate = warehouses.length > 0 ? (activeWHCount / warehouses.length) * 100 : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-8 h-8 text-blue-600 bg-blue-50 rounded-xl p-1 border border-blue-100" />
            Universal Warehouse Dashboard
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">Real-time inventory levels, batch lot trace records, and gross stock valuations</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/inventory/adjust"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
          >
            <ClipboardCheck className="w-4.5 h-4.5" />
            Stock Adjustments
          </Link>
          <Link
            to="/inventory/ledger"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-sm"
          >
            <History className="w-4.5 h-4.5 text-slate-500" />
            Audit Ledger Trail
          </Link>
        </div>
      </div>

      {/* Analytics stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Gross Inventory Valuation</span>
            <span className="text-2xl font-black text-slate-900">
              ₹{grossValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 font-black">
            ₹
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Low Stock Alert SKUs</span>
            <span className={`text-2xl font-black ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {lowStockCount} alerts
            </span>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
            lowStockCount > 0 
              ? 'bg-rose-50 border-rose-100 text-rose-600' 
              : 'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">WH Hubs Active</span>
            <span className="text-2xl font-black text-slate-900">{utilizationRate.toFixed(0)}% utilization</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Query filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Search className="w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search catalog SKU or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full bg-transparent border-none outline-none text-sm text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={whFilter}
            onChange={(e) => setWhFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-600 outline-none"
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <button
            onClick={fetchData}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-all border border-slate-100"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Balances Data Grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold">Scanning stock ledgers...</p>
          </div>
        ) : balances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center p-6 gap-3">
            <Layers className="w-12 h-12 text-slate-350" />
            <div>
              <p className="text-sm font-bold text-slate-900">No Inventory Records Located</p>
              <p className="text-xs text-slate-400 mt-1">Adjust stock balances or issue goods receipts to allocate counts.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Item SKU</th>
                  <th className="px-6 py-4">Warehouse Zone</th>
                  <th className="px-6 py-4">Batch Lot Number</th>
                  <th className="px-6 py-4 text-center">On Hand</th>
                  <th className="px-6 py-4 text-center">Reserved</th>
                  <th className="px-6 py-4 text-center">In Transit</th>
                  <th className="px-6 py-4 text-right">Valuation Cost</th>
                  <th className="px-6 py-4 text-right">Gross Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                {balances.map(bal => {
                  const unitVal = parseFloat(bal.valuation_unit_cost as any || 0);
                  const totalVal = bal.quantity_on_hand * unitVal;
                  return (
                    <tr key={bal.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-extrabold text-blue-600 text-sm block">{bal.item?.sku}</span>
                          <span className="text-xs text-slate-400 font-semibold leading-relaxed line-clamp-1">{bal.item?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-bold">
                        {bal.warehouse?.name}
                      </td>
                      <td className="px-6 py-4">
                        {bal.batch ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                              {bal.batch.batch_number}
                            </span>
                            {bal.batch.expiry_date && (
                              <span className="text-[10px] text-rose-500 block font-semibold">
                                Exp: {new Date(bal.batch.expiry_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-350 font-semibold">Unbatched</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                          bal.quantity_on_hand <= 15 
                            ? 'bg-rose-50 text-rose-700 border border-rose-150 animate-pulse' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                        }`}>
                          {bal.quantity_on_hand} units
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-400 font-medium">
                        {bal.quantity_reserved}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-400 font-medium">
                        {bal.quantity_transit}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">
                        ₹{unitVal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-900 font-black text-sm">
                        ₹{totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

export default WarehouseDashboard;
