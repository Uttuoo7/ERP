import React, { useEffect, useState } from 'react';
import { Landmark, TrendingUp, Clock, Package, AlertTriangle, ShieldAlert, Shield, Database, Sparkles, Timer } from 'lucide-react';
import axios from 'axios';
import { getAnalyticsCommandCenter, triggerAnalyticsSnapshot } from '../../../api';
import { KPICard, KPICardSkeleton } from '../../components/ui/KPICard';
import toast from 'react-hot-toast';

export function ExecutiveDashboard() {
  const [data, setData] = useState<any>(null);
  const [kpiData, setKpiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const [resCmd, resKpi] = await Promise.all([
        getAnalyticsCommandCenter(),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analytics/kpis`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') as string).state.token : ''}` }
        }).catch(() => ({ data: null }))
      ]);
      setData(resCmd.data);
      if (resKpi.data) setKpiData(resKpi.data);
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

      {kpiData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl shadow-xl border border-indigo-800/50 flex flex-col gap-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl">
                <Sparkles className="w-5 h-5 text-indigo-300" />
              </div>
              <h3 className="font-bold text-indigo-50">AI Procurement Insights</h3>
            </div>
            <ul className="space-y-3">
              {kpiData.ai_insights?.map((insight: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-indigo-100/80 font-medium leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  {insight}
                </li>
              ))}
              {(!kpiData.ai_insights || kpiData.ai_insights.length === 0) && (
                <li className="text-sm text-indigo-200/50">Aggregating historical insights...</li>
              )}
            </ul>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Timer className="w-4 h-4 text-blue-500"/> Avg Cycle Time</span>
              <span className="text-2xl font-black text-slate-900">{kpiData.avg_cycle_time_days} <span className="text-sm text-slate-500 font-semibold">Days</span></span>
              <span className="text-[10px] text-emerald-600 font-bold mt-1">PR ➔ PO ➔ GRN</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500"/> Total Savings</span>
              <span className="text-2xl font-black text-slate-900">₹{kpiData.total_savings_ytd?.toLocaleString()}</span>
              <span className="text-[10px] text-slate-500 font-bold mt-1">YTD Negotiated</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Discrepancy Rate</span>
              <span className="text-2xl font-black text-slate-900">{kpiData.invoice_discrepancy_rate}%</span>
              <span className="text-[10px] text-slate-500 font-bold mt-1">Invoices flagged</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Approval Bottlenecks</span>
              <span className="text-2xl font-black text-slate-900">{kpiData.approval_bottleneck_rate}%</span>
              <span className="text-[10px] text-slate-500 font-bold mt-1">Tasks {'>'} 48 hrs</span>
            </div>
          </div>
        </div>
      )}

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
