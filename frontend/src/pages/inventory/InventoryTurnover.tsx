import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Calendar, RefreshCw, TrendingUp, Briefcase, Clock, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { get } from '../../api';

interface TurnoverData {
  cogs: number;
  average_inventory: number;
  turnover_ratio: number;
  turnover_days: number;
}

export const InventoryTurnover: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TurnoverData | null>(null);

  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchTurnover = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate + 'T23:59:59').toISOString()
      };
      const res = await get('/inventory/turnover', { params });
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch inventory turnover statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTurnover();
  }, [startDate, endDate]);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen text-xs font-semibold text-slate-650">
      {/* Header section */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Inventory Turnover Analysis</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Valuation efficiency KPIs, COGS MTD, and Days Sales in Inventory (DSI)</p>
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
          onClick={fetchTurnover}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 h-9"
        >
          <RefreshCw className="w-4 h-4" /> Recalculate
        </button>
      </div>

      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs font-semibold">Calculating turnover coefficients...</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Metrics grids */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
                <Briefcase className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">Cost of Goods Sold (COGS)</span>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">₹{data.cogs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                <TrendingUp className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">Average Inventory Value</span>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">₹{data.average_inventory.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <RefreshCw className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">Turnover Ratio (COGS/Avg)</span>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">{data.turnover_ratio.toFixed(2)}x</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">Days Sales in Inventory (DSI)</span>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">{data.turnover_days.toFixed(1)} Days</h3>
              </div>
            </div>
          </div>

          {/* Business Insights Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-500" /> Business Efficiency Analysis
            </h3>
            <div className="space-y-4 text-xs font-semibold text-slate-600 leading-relaxed max-w-4xl">
              <p>
                <strong>Inventory Turnover Ratio:</strong> Measures how many times inventory is sold and replaced over the period. A higher ratio indicates strong sales performance or efficient inventory management, while a lower ratio suggests sluggish sales, overstocking, or obsolete inventory.
              </p>
              <p>
                <strong>Days Sales in Inventory (DSI):</strong> The average time in days it takes to turn stock into sales. A DSI of <span className="font-extrabold text-slate-900">{data.turnover_days.toFixed(1)} days</span> indicates your average carrying speed before consumption or sale. Lower DSI numbers are generally favorable as they free up cash flow and reduce warehouse storage expenses.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-20 text-center text-slate-400">Failed to load turnover metrics.</div>
      )}
    </div>
  );
};
