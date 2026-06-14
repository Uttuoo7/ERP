import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, Search, ShieldAlert, RefreshCw, Loader2, ClipboardCheck, History, Package
} from 'lucide-react';
import { getInventoryBalances, getWarehouses } from "../api";
import { DataContainer } from '../components/common/DataContainer';
import { useHeaderStore } from '../store/headerStore';
import { useTableDensityStore } from '../store/tableDensityStore';
import { FilterToolbar } from '../components/common/FilterToolbar';
import { TableSkeleton } from '../components/common/TableSkeleton';
import { EmptyState } from '../components/common/EmptyState';

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
  const setHeader = useHeaderStore(state => state.setHeader);
  
  // Global Density
  const { density } = useTableDensityStore();
  const cellPadding = density === 'compact' ? 'px-4 py-2 text-[13px]' : 'px-6 py-4 text-sm';
  const headerPadding = density === 'compact' ? 'px-4 py-3' : 'px-6 py-4';

  useEffect(() => {
    setHeader({
      secondaryActions: (
        <>
          <Link
            to="/inventory/ledger"
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-erp transition-all border border-erp-border shadow-sm"
          >
            <History className="w-4 h-4 text-slate-500" />
            Audit Ledger Trail
          </Link>
          <Link
            to="/inventory/adjust"
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-erp-primary hover:bg-blue-800 rounded-erp transition-all shadow-sm"
          >
            <ClipboardCheck className="w-4 h-4" />
            Stock Adjustments
          </Link>
        </>
      )
    });
    return () => useHeaderStore.getState().clearHeader();
  }, [setHeader]);

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
    <div className="flex flex-col gap-6">
      {/* Analytics stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DataContainer className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Gross Inventory Valuation</span>
            <span className="text-2xl font-black text-slate-900">
              ₹{grossValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 font-black">
            ₹
          </div>
        </DataContainer>

        <DataContainer className="p-6 flex items-center justify-between">
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
        </DataContainer>

        <DataContainer className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">WH Hubs Active</span>
            <span className="text-2xl font-black text-slate-900">{utilizationRate.toFixed(0)}% utilization</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Package className="w-5 h-5" />
          </div>
        </DataContainer>
      </div>

      <DataContainer>
        {/* Query filters */}
        <FilterToolbar 
          searchQuery={search} 
          onSearchChange={setSearch} 
          searchPlaceholder="Search catalog SKU or product name..."
          onSearchSubmit={fetchData}
          filters={
            <select
              value={whFilter}
              onChange={(e) => setWhFilter(e.target.value)}
              className="text-sm bg-transparent border-none text-slate-700 outline-none cursor-pointer"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          }
          actions={
            <button
              onClick={fetchData}
              className="p-1.5 hover:bg-slate-100 rounded-erp text-slate-500 transition-colors bg-white shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          }
        />

        {/* Balances Data Grid */}
        {loading ? (
          <TableSkeleton columns={8} />
        ) : balances.length === 0 ? (
          <EmptyState 
            icon={<Layers className="w-8 h-8" />} 
            title="No Inventory Records Located" 
            description="Adjust stock balances or issue goods receipts to allocate counts." 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-erp-border shadow-sm">
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className={headerPadding}>Item SKU</th>
                  <th className={headerPadding}>Warehouse Zone</th>
                  <th className={headerPadding}>Batch Lot Number</th>
                  <th className={`${headerPadding} text-center`}>On Hand</th>
                  <th className={`${headerPadding} text-center`}>Reserved</th>
                  <th className={`${headerPadding} text-center`}>In Transit</th>
                  <th className={`${headerPadding} text-right`}>Valuation Cost</th>
                  <th className={`${headerPadding} text-right`}>Gross Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-erp-border font-semibold text-slate-700">
                {balances.map(bal => {
                  const unitVal = parseFloat(bal.valuation_unit_cost as any || 0);
                  const totalVal = bal.quantity_on_hand * unitVal;
                  return (
                    <tr key={bal.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className={cellPadding}>
                        <div>
                          <span className="font-extrabold text-erp-primary text-sm block">{bal.item?.sku}</span>
                          <span className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-1">{bal.item?.name}</span>
                        </div>
                      </td>
                      <td className={`${cellPadding} text-slate-900 font-bold`}>
                        {bal.warehouse?.name}
                      </td>
                      <td className={cellPadding}>
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
                          <span className="text-xs text-slate-400 font-medium">Unbatched</span>
                        )}
                      </td>
                      <td className={`${cellPadding} text-center`}>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                          bal.quantity_on_hand <= 15 
                            ? 'bg-rose-50 text-rose-700 border border-rose-150 animate-pulse' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                        }`}>
                          {bal.quantity_on_hand} units
                        </span>
                      </td>
                      <td className={`${cellPadding} text-center text-slate-500 font-medium`}>
                        {bal.quantity_reserved}
                      </td>
                      <td className={`${cellPadding} text-center text-slate-500 font-medium`}>
                        {bal.quantity_transit}
                      </td>
                      <td className={`${cellPadding} text-right text-slate-500`}>
                        ₹{unitVal.toFixed(2)}
                      </td>
                      <td className={`${cellPadding} text-right text-slate-900 font-black text-sm`}>
                        ₹{totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataContainer>
    </div>
  );
};

export default WarehouseDashboard;
