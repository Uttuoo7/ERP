import React, { useState, useEffect } from 'react';
import { Package, MapPin, Activity, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import api from "../../api";

export function InventoryDashboard() {
  const [stock, setStock] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const stockRes = await api.get('/inventory/stock');
      const ledgerRes = await api.get('/inventory/ledger');
      setStock(stockRes.data);
      setLedger(ledgerRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Package className="w-8 h-8 text-indigo-600" />
            Inventory & Material Flow
          </h1>
          <p className="text-slate-500 mt-1">Enterprise stock valuation and ledger movement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Activity className="w-6 h-6" />
            <h3 className="font-bold text-slate-700">Total Valuation</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">$1,450,200</div>
          <div className="text-sm text-green-600 flex items-center mt-2 font-medium">
            <ArrowUpRight className="w-4 h-4 mr-1" /> +2.4% from last month
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="font-bold text-slate-700">Low Stock Alerts</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">14 Items</div>
          <div className="text-sm text-slate-500 mt-2 font-medium">Below standard reorder level</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <MapPin className="w-6 h-6" />
            <h3 className="font-bold text-slate-700">Active Warehouses</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">4</div>
          <div className="text-sm text-slate-500 mt-2 font-medium">Across 2 states</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
        {/* Stock Levels */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
            Current Stock Levels
          </div>
          <div className="flex-1 overflow-auto p-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">Item ID</th>
                  <th className="pb-3 font-medium text-right">Available</th>
                  <th className="pb-3 font-medium text-right">Reserved</th>
                </tr>
              </thead>
              <tbody>
                {stock.map(s => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="py-3 text-sm text-slate-700 font-medium">{s.item_id}</td>
                    <td className="py-3 text-sm text-right font-bold text-indigo-600">{s.available_stock}</td>
                    <td className="py-3 text-sm text-right text-amber-600">{s.reserved_stock}</td>
                  </tr>
                ))}
                {stock.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-slate-400">No stock found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ledger */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
            Stock Ledger Movements
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-3">
              {ledger.map(l => (
                <div key={l.id} className="p-3 border border-slate-100 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-indigo-600 mb-1">{l.transaction_type}</div>
                    <div className="text-sm font-medium text-slate-800">{l.reference_type} #{l.reference_id}</div>
                    <div className="text-xs text-slate-500 mt-1">{new Date(l.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    {l.qty_in > 0 && <div className="text-sm font-bold text-emerald-600">+{l.qty_in} In</div>}
                    {l.qty_out > 0 && <div className="text-sm font-bold text-rose-600">-{l.qty_out} Out</div>}
                    <div className="text-xs font-medium text-slate-500 mt-1">Bal: {l.balance_after}</div>
                  </div>
                </div>
              ))}
              {ledger.length === 0 && <div className="py-4 text-center text-slate-400">No ledger movements found</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
