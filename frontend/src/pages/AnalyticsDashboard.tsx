import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Clock, CheckCircle, Filter, Calendar, ChevronRight, Package, Users, BarChart3, 
  SearchX, ShieldAlert, Sparkles, Building, Database, Landmark, AlertTriangle, Shield, Check, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getAnalyticsCommandCenter,
  getAnalyticsProcurement,
  getAnalyticsInventory,
  getAnalyticsFinance,
  getAnalyticsWorkflow,
  getAnalyticsVendors,
  triggerAnalyticsSnapshot
} from '../api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
);

const KPICard = ({ title, value, icon: Icon, color, subtext, statusColor = "text-slate-400" }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-150 flex items-center gap-4 hover:shadow-md transition-shadow duration-300">
    <div className={`p-3.5 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 leading-none">{value ?? 0}</h3>
      {subtext && <p className={`text-[10px] font-semibold ${statusColor}`}>{subtext}</p>}
    </div>
  </div>
);

const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'command' | 'procurement' | 'inventory' | 'finance' | 'workflow' | 'vendors'>('command');

  // Sub-metrics structures
  const [commandData, setCommandData] = useState<any>(null);
  const [procurementData, setProcurementData] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [vendorData, setVendorData] = useState<any[]>([]);

  const [refreshing, setRefreshing] = useState(false);

  const fetchTabMetrics = async () => {
    setLoading(true);
    try {
      if (activeTab === 'command') {
        const res = await getAnalyticsCommandCenter();
        setCommandData(res.data);
      } else if (activeTab === 'procurement') {
        const res = await getAnalyticsProcurement();
        setProcurementData(res.data);
      } else if (activeTab === 'inventory') {
        const res = await getAnalyticsInventory();
        setInventoryData(res.data);
      } else if (activeTab === 'finance') {
        const res = await getAnalyticsFinance();
        setFinanceData(res.data);
      } else if (activeTab === 'workflow') {
        const res = await getAnalyticsWorkflow();
        setWorkflowData(res.data);
      } else if (activeTab === 'vendors') {
        const res = await getAnalyticsVendors();
        setVendorData(res.data);
      }
    } catch (err) {
      toast.error("Failed to load analytical snapshot data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabMetrics();
  }, [activeTab]);

  const handleCacheRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerAnalyticsSnapshot();
      toast.success("Aggregate snapshots and cache updated successfully!");
      fetchTabMetrics();
    } catch (err) {
      toast.error("Failed to refresh snapshots cache.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen text-xs font-semibold text-slate-500">
      {/* Header and command cache options */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Enterprise Executive Command Cockpit</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Unified command control systems across procurement pipelines, liabilities accruals, stock velocities, and operational bottlenecks</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCacheRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100/50 border border-blue-100 text-blue-600 rounded-xl transition-all font-bold text-xs"
          >
            <Database className="w-4 h-4" />
            {refreshing ? "Re-aggregating..." : "Refresh Snapshots Cache"}
          </button>
        </div>
      </div>

      {/* Control Tabs Matrix */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1">
        <button
          onClick={() => setActiveTab('command')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'command' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Building className="w-4.5 h-4.5" /> Command Center
        </button>
        <button
          onClick={() => setActiveTab('procurement')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'procurement' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <TrendingUp className="w-4.5 h-4.5" /> Procurement Spend
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'inventory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Package className="w-4.5 h-4.5" /> Stock Velocity
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'finance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Landmark className="w-4.5 h-4.5" /> Finance & AP
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'workflow' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Clock className="w-4.5 h-4.5" /> Workflow Bottlenecks
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'vendors' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className="w-4.5 h-4.5" /> Vendor Reliability
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tab 1: Executive Command center */}
          {activeTab === 'command' && commandData && (
            <div className="space-y-8">
              {/* KPI cards matrix */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KPICard
                  title="Accrued AP Liabilities"
                  value={`₹${commandData.payable_liabilities.toLocaleString()}`}
                  icon={Landmark}
                  color="bg-rose-600"
                  subtext="Outstanding vendor payables"
                  statusColor="text-rose-600"
                />
                <KPICard
                  title="Procurement Spend"
                  value={`₹${commandData.total_spend.toLocaleString()}`}
                  icon={TrendingUp}
                  color="bg-blue-600"
                  subtext="Total Purchase Orders issued"
                />
                <KPICard
                  title="Pending Approvals"
                  value={commandData.pending_approvals}
                  icon={Clock}
                  color="bg-amber-500"
                  subtext="Awaiting executive authorization"
                  statusColor={commandData.pending_approvals > 3 ? "text-amber-600 font-extrabold animate-pulse" : ""}
                />
                <KPICard
                  title="Warehouse health"
                  value={`${commandData.warehouse_utilization_pct}%`}
                  icon={Package}
                  color="bg-emerald-600"
                  subtext="Active space utilization"
                />
              </div>

              {/* Warnings and Commands Cockpit grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Delayed deliveries */}
                <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-905 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-500" /> Delayed Deliveries Alerts
                  </h3>
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Delayed items</span>
                    <span className="text-sm font-black text-slate-900">{commandData.delayed_deliveries} POs</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    These Purchase Orders have passed their expected warehouse receipt date. Contact corresponding buyers to reconcile supply parameters.
                  </p>
                </div>

                {/* Low stock indicators */}
                <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-905 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert className="w-4.5 h-4.5 text-rose-500" /> Low Stock SKU Alerts
                  </h3>
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Reorder trigger reached</span>
                    <span className="text-sm font-black text-rose-600">{commandData.low_stock_alerts} lines</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    Stock balances have dropped below safety buffer lines. Immediate Purchase Requisitions should be raised to maintain pipeline continuity.
                  </p>
                </div>

                {/* Mismatched invoices warnings */}
                <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-905 uppercase tracking-widest flex items-center gap-1.5">
                    <Shield className="w-4.5 h-4.5 text-blue-500" /> 3-Way Match Exception Alerts
                  </h3>
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Variances found</span>
                    <span className="text-sm font-black text-slate-900">{commandData.mismatched_invoices} Invoices</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    Discrepancies in billing vs PO price or GRN quantities. These are held in discrepancy queues for manual resolution review.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Procurement spend intelligence */}
          {activeTab === 'procurement' && procurementData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Quote conversion rates */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  RFQ Conversion & Quote Efficiency
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-slate-50/50">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">RFQ Conversion rate</span>
                    <span className="text-2xl font-black text-slate-900 block mt-1">{procurementData.rfq_conversion_pct}%</span>
                  </div>
                  <div className="p-4 rounded-xl border bg-slate-50/50">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Calculated savings</span>
                    <span className="text-2xl font-black text-emerald-600 block mt-1">₹{procurementData.procurement_savings_inr.toLocaleString()}</span>
                  </div>
                </div>

                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={procurementData.po_aging_distribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Vendor spend distribution */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  Top Vendors Share by total spend
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">Vendor Name</th>
                        <th className="pb-2 text-center">Orders Count</th>
                        <th className="pb-2 text-right">Total spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-semibold text-slate-700">
                      {procurementData.vendor_spend_distribution.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 font-extrabold text-slate-900">{item.vendor}</td>
                          <td className="py-3 text-center text-slate-500">{item.po_count}</td>
                          <td className="py-3 text-right text-blue-600 font-bold">₹{item.spend.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Inventory stock intelligence */}
          {activeTab === 'inventory' && inventoryData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Valuation summaries */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">
                  Inventory Valuation & Utilizations
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-slate-50/50">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Total Stock valuation</span>
                    <span className="text-xl font-black text-slate-900 block mt-1">₹{inventoryData.inventory_valuation_inr.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl border bg-slate-50/50">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Safety margin dead SKU count</span>
                    <span className="text-xl font-black text-slate-900 block mt-1">{inventoryData.dead_stock_skus_count} SKUs</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Fast-moving SKU levels show active stock velocities. Ensure supply reorder rates are mapped to match standard pipeline demands.
                </p>
              </div>

              {/* Fast moving SKUs */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">
                  Highest velocity SKUs list
                </h3>

                <div className="divide-y font-semibold text-slate-700">
                  {inventoryData.fast_moving_skus.map((item: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <span className="font-extrabold text-slate-905">{item.item_name}</span>
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded text-[10px] font-black">{item.stock_level} units on stock</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Finance command details */}
          {activeTab === 'finance' && financeData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Liability buckets table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-slate-905 uppercase tracking-widest">
                  Payable Aging buckets matrix
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">Aging bucket</th>
                        <th className="pb-2 text-right">Outstanding value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-semibold text-slate-700 bg-white">
                      {financeData.liability_buckets.map((b: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 font-extrabold text-slate-900">{b.bucket}</td>
                          <td className="py-3 text-right text-rose-600 font-bold">₹{b.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cash outflow forecast chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">
                  AP Cash outflow forecasts (Quarterly)
                </h3>

                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financeData.cash_outflow_forecast}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                      <Area type="monotone" dataKey="forecast" stroke="#3b82f6" fill="#eff6ff" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Workflow Bottlenecks */}
          {activeTab === 'workflow' && workflowData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bottleneck values */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">
                  Workflow Bottlenecks indicators
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-slate-50/50">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Avg approval time</span>
                    <span className="text-xl font-black text-slate-900 block mt-1">{workflowData.average_approval_hours} Hours</span>
                  </div>
                  <div className="p-4 rounded-xl border bg-slate-50/50">
                    <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Escalated counts</span>
                    <span className="text-xl font-black text-rose-600 block mt-1">{workflowData.escalated_workflows_count} Steps</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Delayed approvals flag critical blocks in the processing pipeline. Review structural bounds to streamline transaction workflows.
                </p>
              </div>

              {/* Workloads list */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">
                  Approver queue workload balances
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">Approver role</th>
                        <th className="pb-2 text-center">Pending tasks</th>
                        <th className="pb-2 text-right">Avg response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-semibold text-slate-700">
                      {workflowData.approver_workloads.map((w: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 font-extrabold text-slate-905">{w.approver}</td>
                          <td className="py-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-bold text-[10px]">{w.pending_count} pending</span>
                          </td>
                          <td className="py-3 text-right text-slate-500">{w.avg_response_hours} Hours</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Vendor scorecards comparisons */}
          {activeTab === 'vendors' && vendorData && (
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                Vendor Reliability scorecards matrix
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                      <th className="px-4 py-3">Vendor Name</th>
                      <th className="px-4 py-3 text-center">On-Time Delivery %</th>
                      <th className="px-4 py-3 text-center">Rejection rate %</th>
                      <th className="px-4 py-3 text-center">Pricing Rank</th>
                      <th className="px-4 py-3 text-right">Reliability Index</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-semibold text-slate-750 bg-white">
                    {vendorData.map((v: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-4 py-3.5 font-extrabold text-slate-900">{v.vendor_name}</td>
                        <td className="px-4 py-3.5 text-center text-emerald-600 font-black">{v.on_time_delivery_pct}%</td>
                        <td className="px-4 py-3.5 text-center text-rose-500 font-black">{v.rejection_rate_pct}%</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-black text-[9.5px]">
                            {v.pricing_competitiveness}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-slate-900">{v.overall_reliability_score} / 100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
