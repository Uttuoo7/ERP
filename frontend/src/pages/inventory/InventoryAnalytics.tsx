import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  RefreshCw, 
  Package, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingDown, 
  Clock, 
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  HelpCircle
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart,
  Bar
} from 'recharts';

interface StockItem {
  item_id: string;
  sku: string;
  name: string;
  quantity_on_hand: number;
  inventory_value: number;
  days_since_last_issue: number;
}

interface ExposureItem {
  sku: string;
  name: string;
  inventory_value: number;
  po_commitment: number;
  total_exposure: number;
}

interface AnalyticsData {
  turnover_ratio: number;
  turnover_days: number;
  slow_moving: StockItem[];
  dead_stock: StockItem[];
  obsolete_stock: StockItem[];
  exposure: ExposureItem[];
  trends: Record<string, any>[];
}

const PALETTE = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];

export default function InventoryAnalytics() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnalyticsData>({
    turnover_ratio: 0,
    turnover_days: 0,
    slow_moving: [],
    dead_stock: [],
    obsolete_stock: [],
    exposure: [],
    trends: []
  });

  const [activeTab, setActiveTab] = useState<'slow' | 'dead' | 'obsolete'>('slow');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/analytics');
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load inventory intelligence analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Extract trend data keys (warehouses) dynamically
  const trendKeys = data.trends.length > 0 
    ? Object.keys(data.trends[0]).filter(k => k !== 'date') 
    : [];

  const getActiveList = () => {
    switch (activeTab) {
      case 'slow': return data.slow_moving;
      case 'dead': return data.dead_stock;
      case 'obsolete': return data.obsolete_stock;
    }
  };

  const getActiveTitle = () => {
    switch (activeTab) {
      case 'slow': return 'Slow Moving Stock (30-90 Days Idle)';
      case 'dead': return 'Dead Stock (90-180 Days Idle)';
      case 'obsolete': return 'Obsolete Stock (180+ Days Idle)';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            Inventory Intelligence Hub
          </h1>
          <p className="text-slate-500 mt-1">
            Turnover ratios, aging stock analysis, PO commitment exposures, and historical valuation trends.
          </p>
        </div>
        
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition duration-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Aggregating transactional histories and calculating turnover ratios...</p>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
              <div>
                <span className="text-indigo-600 text-xs font-bold uppercase tracking-wider">Velocity Metric</span>
                <h3 className="text-sm font-medium text-slate-700 mt-1">Inventory Turnover Ratio</h3>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-black text-slate-950">{data.turnover_ratio}x</span>
                <span className="text-xs text-slate-500">annualized rate (30d window)</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
              <div>
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Days Sales of Inventory</span>
                <h3 className="text-sm font-medium text-slate-700 mt-1">Average Clearing Days</h3>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-black text-slate-950">{data.turnover_days}</span>
                <span className="text-xs text-slate-500">days to completely deplete</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
              <div>
                <span className="text-amber-600 text-xs font-bold uppercase tracking-wider">Capital Locks</span>
                <h3 className="text-sm font-medium text-slate-700 mt-1">Aging & Idle SKU Lines</h3>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-black text-amber-600">
                  {data.slow_moving.length + data.dead_stock.length + data.obsolete_stock.length}
                </span>
                <span className="text-xs text-slate-500">SKUs with zero 30d issues</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl shadow-md p-6 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider">Liability & Asset Exposure</span>
                <h3 className="text-sm font-medium text-slate-200 mt-1">Total Capital Commitments</h3>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-2xl font-black tracking-tight text-indigo-300">
                  {formatCurrency(data.exposure.reduce((acc, curr) => acc + curr.total_exposure, 0))}
                </span>
                <span className="text-xs text-slate-400">Stock + PO Pipeline</span>
              </div>
            </div>

          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Historical Valuation Trend Area Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Valuation Trends</h3>
                  <p className="text-xs text-slate-500">Historical asset value progression aggregated by warehouse</p>
                </div>
              </div>

              <div className="h-80 w-full">
                {data.trends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    No trend snapshots recorded. Run snapshots to build historical trend lines.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.trends}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} 
                      />
                      <Tooltip 
                        formatter={(val: any) => [formatCurrency(val), 'Value']}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                      {trendKeys.map((key, idx) => (
                        <Area
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stackId="1"
                          stroke={PALETTE[idx % PALETTE.length]}
                          fill={PALETTE[idx % PALETTE.length]}
                          fillOpacity={0.15}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Exposure Breakdown Bar Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Top Capital Exposures</h3>
                <p className="text-xs text-slate-500">Top 5 items by total locked and pipeline commitments</p>
              </div>

              <div className="h-80 w-full">
                {data.exposure.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    No exposure data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.exposure.slice(0, 5)}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="sku" type="category" stroke="#94a3b8" fontSize={11} width={60} tickLine={false} />
                      <Tooltip 
                        formatter={(val: any) => [formatCurrency(val)]}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="inventory_value" name="On-hand Assets" fill="#4f46e5" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="po_commitment" name="PO Commitments" fill="#06b6d4" stackId="a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Aging Stocks & Top Exposures Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Aging Stock Analysis Tabs */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-lg">Aging Stock Analysis</h3>
                <p className="text-xs text-slate-500">Locate under-utilized or obsolete inventory items to release capital locks</p>
              </div>

              <div className="flex border-b border-slate-150 bg-slate-50/50 p-2">
                <button
                  onClick={() => setActiveTab('slow')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-150 ${
                    activeTab === 'slow' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Slow Moving ({data.slow_moving.length})
                </button>
                <button
                  onClick={() => setActiveTab('dead')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-150 ${
                    activeTab === 'dead' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Dead Stock ({data.dead_stock.length})
                </button>
                <button
                  onClick={() => setActiveTab('obsolete')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-150 ${
                    activeTab === 'obsolete' ? 'bg-white shadow-sm text-rose-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Obsolete ({data.obsolete_stock.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-96">
                {getActiveList()?.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-sm">
                    No items in this category. Inventory clearing velocity is healthy.
                  </div>
                ) : (
                  <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50/50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold">SKU & Item</th>
                        <th className="px-6 py-3 font-semibold text-right">Qty On Hand</th>
                        <th className="px-6 py-3 font-semibold text-right">Value (INR)</th>
                        <th className="px-6 py-3 font-semibold text-right">Idle Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getActiveList()?.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/30">
                          <td className="px-6 py-3.5">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="text-xs font-mono text-slate-400 mt-0.5">{item.sku}</div>
                          </td>
                          <td className="px-6 py-3.5 text-right font-medium text-slate-900">
                            {Number(item.quantity_on_hand).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5 text-right font-semibold font-mono text-slate-950">
                            {formatCurrency(item.inventory_value)}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              item.days_since_last_issue >= 180 
                                ? 'bg-rose-50 text-rose-800 border border-rose-100' 
                                : item.days_since_last_issue >= 90 
                                ? 'bg-amber-50 text-amber-800 border border-amber-100' 
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {item.days_since_last_issue === 9999 ? 'Never Issued' : `${item.days_since_last_issue} days`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Top Exposure Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-lg">Capital Commitments Explorer</h3>
                <p className="text-xs text-slate-500">Items with highest financial risk combining current assets and pending purchases</p>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[440px]">
                {data.exposure.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-sm">
                    No exposure data available.
                  </div>
                ) : (
                  <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold">SKU & Item Name</th>
                        <th className="px-6 py-3 font-semibold text-right">On-hand Assets</th>
                        <th className="px-6 py-3 font-semibold text-right">PO Commitments</th>
                        <th className="px-6 py-3 font-semibold text-right">Total Exposure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exposure.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/30">
                          <td className="px-6 py-3.5">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="text-xs font-mono text-slate-400 mt-0.5">{item.sku}</div>
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-slate-650">
                            {formatCurrency(item.inventory_value)}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-cyan-650">
                            {formatCurrency(item.po_commitment)}
                          </td>
                          <td className="px-6 py-3.5 text-right font-bold font-mono text-slate-950 bg-slate-50/20">
                            {formatCurrency(item.total_exposure)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
