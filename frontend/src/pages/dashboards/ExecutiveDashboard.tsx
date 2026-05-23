import React, { useEffect, useState } from 'react';
import { Landmark, TrendingUp, Clock, Package, AlertTriangle, ShieldAlert, Shield, Database } from 'lucide-react';
import { getAnalyticsCommandCenter, triggerAnalyticsSnapshot } from '../../../api';
import { KPICard, KPICardSkeleton } from '../../components/ui/KPICard';
import toast from 'react-hot-toast';

export function ExecutiveDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await getAnalyticsCommandCenter();
      setData(res.data);
    } catch (err) {
      toast.error("Failed to load analytical snapshot data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleCacheRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerAnalyticsSnapshot();
      toast.success("Aggregate snapshots and cache updated successfully!");
      fetchMetrics();
    } catch (err) {
      toast.error("Failed to refresh snapshots cache.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-96 bg-slate-100 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Command Cockpit</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Unified control systems across procurement pipelines and liabilities.</p>
        </div>
        <button
          onClick={handleCacheRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg transition-all font-semibold text-sm shadow-sm"
        >
          <Database className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? "Re-aggregating..." : "Refresh Snapshots"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title="Accrued AP Liabilities"
          value={`₹${data?.payable_liabilities?.toLocaleString() || '0'}`}
          icon={Landmark}
          iconColorClass="bg-rose-50 text-rose-600"
          subtext="Outstanding vendor payables"
        />
        <KPICard
          title="Procurement Spend"
          value={`₹${data?.total_spend?.toLocaleString() || '0'}`}
          icon={TrendingUp}
          iconColorClass="bg-blue-50 text-blue-600"
          subtext="Total POs issued"
        />
        <KPICard
          title="Pending Approvals"
          value={data?.pending_approvals || 0}
          icon={Clock}
          iconColorClass="bg-amber-50 text-amber-600"
          subtext="Awaiting authorization"
          statusColorClass={data?.pending_approvals > 3 ? "text-amber-600" : ""}
        />
        <KPICard
          title="Warehouse health"
          value={`${data?.warehouse_utilization_pct || 0}%`}
          icon={Package}
          iconColorClass="bg-emerald-50 text-emerald-600"
          subtext="Active space utilization"
        />
      </div>

      {/* Warnings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Delayed Deliveries
          </h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-slate-900 leading-none">{data?.delayed_deliveries || 0}</span>
            <span className="text-sm font-semibold text-slate-500 mb-0.5">POs</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Purchase Orders past their expected warehouse receipt date.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" /> Low Stock SKU Alerts
          </h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-rose-600 leading-none">{data?.low_stock_alerts || 0}</span>
            <span className="text-sm font-semibold text-slate-500 mb-0.5">Lines</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Stock balances dropped below safety buffer lines.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" /> 3-Way Match Exceptions
          </h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-slate-900 leading-none">{data?.mismatched_invoices || 0}</span>
            <span className="text-sm font-semibold text-slate-500 mb-0.5">Invoices</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Discrepancies in billing vs PO price or GRN quantities.
          </p>
        </div>
      </div>
    </div>
  );
}
