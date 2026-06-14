import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Calendar, RefreshCw, FileSpreadsheet,
  Building, Layers, Users, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { get } from '../../api';

interface ConsumptionRow {
  department: string;
  warehouse: string;
  category: string;
  sku: string;
  item_name: string;
  quantity_issued: number;
  consumption_cost: number;
  costing_method: string;
}

export const InventoryConsumptionReport: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ConsumptionRow[]>([]);

  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate + 'T23:59:59').toISOString()
      };
      const res = await get('/inventory/consumption', { params });
      setRows(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load consumption report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

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
            <h1 className="text-2xl font-black text-slate-900 leading-none">Material Consumption Report</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Summary of inventory issued out, internal consumption, and scrap grouped by cost center</p>
          </div>
        </div>
      </div>

      {/* Date Filters Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex flex-wrap gap-4 items-end">
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

        <button
          onClick={fetchReport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 h-9"
        >
          <RefreshCw className="w-4 h-4" /> Recalculate
        </button>
      </div>

      {/* Consumption Table Card */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-semibold">Summarizing material release entries...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2 text-center">
            <Users className="w-10 h-10 text-slate-300 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-450">No Material consumption logged</span>
            <span className="text-[10px] text-slate-355 mt-1">No POSTED consumption logs exist within this date range.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                  <th className="p-4">Cost Center Dept</th>
                  <th className="p-4">Warehouse Zone</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">SKU / Component</th>
                  <th className="p-4 text-right">Quantity Issued</th>
                  <th className="p-4 text-right">Consumption Cost (₹)</th>
                  <th className="p-4">Costing Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-slate-900 font-extrabold">{row.department}</td>
                    <td className="p-4 text-slate-650 font-bold">{row.warehouse}</td>
                    <td className="p-4 text-slate-500">{row.category}</td>
                    <td className="p-4">
                      <div className="font-extrabold text-slate-800">{row.sku}</div>
                      <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[200px]">{row.item_name}</div>
                    </td>
                    <td className="p-4 text-right font-extrabold text-slate-800">{Number(row.quantity_issued).toFixed(4)}</td>
                    <td className="p-4 text-right font-extrabold text-slate-900">₹{Number(row.consumption_cost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-100 rounded">
                        {row.costing_method}
                      </span>
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
