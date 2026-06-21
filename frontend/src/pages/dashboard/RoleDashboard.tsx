import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { get, getWorkflowInbox } from '../../api';
import { 
  TrendingUp, Award, Users, Settings, Briefcase, CreditCard, 
  AlertTriangle, CheckCircle, Clock, ArrowRight, Play, RefreshCw,
  Box, Cpu, ShoppingBag, ShieldAlert, BarChart3, Database, Key, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StandardPageFramework } from '../../components/common/StandardPageFramework';

// Role selection dropdown for Development / Demo environment
const SHOW_DEV_SWITCHER = true; // Set true for demo/evaluation

// ─── WIDGET-LEVEL SKELETONS & INDEPENDENT COMPONENTS ────────────────────────

function KPICardSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
        </div>
        <div className="w-8 h-8 bg-slate-200 rounded-xl"></div>
      </div>
      <div className="h-3 bg-slate-200 rounded w-1/2 mt-3"></div>
    </div>
  );
}

function ActivityTimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-2 h-2 rounded-full bg-slate-200 mt-1.5 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 bg-slate-200 rounded w-3/4"></div>
            <div className="h-2 bg-slate-200 rounded w-1/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalsKPICard() {
  const [approvalsCount, setApprovalsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchApprovals = () => {
    setLoading(true);
    setError(false);
    getWorkflowInbox()
      .then((res) => {
        setApprovalsCount((res.data || []).length);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch approvals:', err);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  if (loading) {
    return <KPICardSkeleton />;
  }

  if (error || approvalsCount === null) {
    return (
      <KPICard
        title="Approvals Required"
        value="--"
        subtitle="Error sync metrics"
        icon={<CheckCircle className="text-rose-400" />}
        severity="danger"
      />
    );
  }

  return (
    <KPICard
      title="Approvals Required"
      value={approvalsCount}
      subtitle="PO commitments"
      icon={<CheckCircle className="text-blue-500" />}
      severity={approvalsCount > 0 ? "warning" : "success"}
    />
  );
}

function SystemActivityTimelineWidget() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchActivities = () => {
    setLoading(true);
    setError(false);
    get('/activity/?limit=6')
      .then((res) => {
        setActivities(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch activities:', err);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" /> System Activity Timeline
        </h3>
        <button
          onClick={fetchActivities}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          title="Refresh activity logs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {loading ? (
        <ActivityTimelineSkeleton />
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-xs text-rose-500 font-bold mb-2">Failed to load activity logs</p>
          <button 
            onClick={fetchActivities}
            className="text-[10px] font-black text-blue-600 uppercase tracking-wider border border-blue-200 px-2 py-1 rounded bg-blue-50/50 hover:bg-blue-50 transition"
          >
            Retry
          </button>
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-slate-400 font-semibold py-4 text-center">No recent activity found.</p>
      ) : (
        <div className="space-y-4 max-h-[240px] overflow-y-auto pr-1">
          {activities.slice(0, 4).map((act: any) => (
            <div key={act.id} className="flex gap-3 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <div className="font-bold text-slate-800">{act.description}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  {new Date(act.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RoleDashboard() {
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const currentRole = currentUser?.role || 'EMPLOYEE';

  // State to support runtime role switching for evaluation/demo
  const [activeRole, setActiveRole] = useState<string>(currentRole);
  
  // Customizer state
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [widgetSettings, setWidgetSettings] = useState<Record<string, { size: 'sm' | 'md' | 'lg' | 'full', visible: boolean }>>({
    kpis: { size: 'full', visible: true },
    sec1: { size: 'md', visible: true },
    sec2: { size: 'md', visible: true }
  });

  const layoutKey = `erp-dashboard-layout-${activeRole}`;

  // Load layout preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem(layoutKey);
      if (stored) {
        setWidgetSettings(JSON.parse(stored));
      } else {
        setWidgetSettings({
          kpis: { size: 'full', visible: true },
          sec1: { size: 'md', visible: true },
          sec2: { size: 'md', visible: true }
        });
      }
    } catch (e) {}
  }, [activeRole, layoutKey]);

  const saveLayout = (newSettings: typeof widgetSettings) => {
    setWidgetSettings(newSettings);
    try {
      localStorage.setItem(layoutKey, JSON.stringify(newSettings));
    } catch (e) {}
  };

  const handleUpdateWidget = (id: string, patch: Partial<{ size: 'sm' | 'md' | 'lg' | 'full'; visible: boolean }>) => {
    const current = widgetSettings[id] || { size: 'md', visible: true };
    const updated = { ...widgetSettings, [id]: { ...current, ...patch } };
    saveLayout(updated);
    toast.success('Widget preferences saved.');
  };

  const resetLayout = () => {
    const defaults = {
      kpis: { size: 'full' as const, visible: true },
      sec1: { size: 'md' as const, visible: true },
      sec2: { size: 'md' as const, visible: true }
    };
    saveLayout(defaults);
    toast.success('Default layouts restored.');
  };

  // Handle activeRole sync if user logs in with different role
  useEffect(() => {
    if (currentUser?.role) {
      setActiveRole(currentUser.role);
    }
  }, [currentUser?.role]);

  // Helper formatting for currency
  const formatINR = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  // Widget wrapping layout manager component
  function WidgetContainer({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    const config = widgetSettings[id] || { size: 'md', visible: true };
    if (!config.visible && !isCustomizing) return null;

    const sizeClasses = {
      sm: 'col-span-12 lg:col-span-3',
      md: 'col-span-12 lg:col-span-6',
      lg: 'col-span-12 lg:col-span-9',
      full: 'col-span-12'
    };

    const activeClass = sizeClasses[config.size] || 'col-span-6';

    return (
      <div 
        className={`${activeClass} border border-slate-200 bg-white rounded-2xl relative transition-all duration-200 ${
          isCustomizing ? 'ring-2 ring-blue-500/30' : ''
        } ${!config.visible ? 'opacity-40 border-dashed bg-slate-50' : ''}`}
      >
        {isCustomizing && (
          <div className="absolute top-3 right-3 bg-slate-900/90 text-white rounded-lg p-1 px-2 flex items-center gap-1.5 z-40 text-[9px] font-bold select-none">
            <span className="text-slate-400">Size:</span>
            <select
              value={config.size}
              onChange={(e) => handleUpdateWidget(id, { size: e.target.value as any })}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer font-bold"
            >
              <option value="sm">Small (25%)</option>
              <option value="md">Medium (50%)</option>
              <option value="lg">Large (75%)</option>
              <option value="full">Full Width</option>
            </select>
            <button
              onClick={() => handleUpdateWidget(id, { visible: !config.visible })}
              className={`px-1 rounded ${config.visible ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 text-white'}`}
            >
              {config.visible ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
        <div className={id === 'kpis' ? '' : 'p-6 h-full flex flex-col justify-between'}>
          {children}
        </div>
      </div>
    );
  }

  // 1. RENDER ROLE-SPECIFIC CONTENT
  const renderDashboardWidgets = () => {
    switch (activeRole) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return renderAdminDashboard();
      case 'PROCUREMENT_MANAGER':
      case 'BUYER':
        return renderProcurementDashboard();
      case 'WAREHOUSE_MANAGER':
      case 'WAREHOUSE':
        return renderInventoryDashboard();
      case 'EMPLOYEE': 
        return renderProductionDashboard();
      case 'FINANCE_MANAGER':
      case 'FINANCE':
        return renderFinanceDashboard();
      default:
        return renderExecutiveDashboard();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTION MANAGER WIDGETS
  // ─────────────────────────────────────────────────────────────────────────
  const renderProductionDashboard = () => (
    <div className="grid grid-cols-12 gap-6">
      {/* KPIs */}
      <WidgetContainer id="kpis" title="KPI metrics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Work Orders Due Today" value="12" subtitle="3 Critical priority" icon={<Cpu className="text-blue-500" />} trend="+10% from yesterday" />
          <KPICard title="Active Operations" value="8" subtitle="On shop floor" icon={<Play className="text-emerald-500" />} />
          <KPICard title="Bottleneck Work Centers" value="WC-02" subtitle="Effective utilization at 98%" icon={<AlertTriangle className="text-amber-500" />} severity="warning" />
          <KPICard title="APS Schedule Stability" value="94.6%" subtitle="Target is > 90%" icon={<TrendingUp className="text-indigo-500" />} />
        </div>
      </WidgetContainer>

      {/* Open Tasks & Exceptions */}
      <WidgetContainer id="sec1" title="APS Scheduling Exceptions">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-slate-400" /> APS Scheduling Exceptions
        </h3>
        <div className="space-y-3">
          <ExceptionItem title="Material Shortage on WO-992" detail="SKU-882 (Raw Steel) insufficient stock" urgency="high" />
          <ExceptionItem title="Maintenance Overlap WC-04" detail="Scheduled downtime overlaps active order" urgency="medium" />
          <ExceptionItem title="Late Delivery Risk WO-819" detail="Est. completion is 4 hours past deadline" urgency="high" />
        </div>
      </WidgetContainer>

      {/* Work Order Due Today list */}
      <WidgetContainer id="sec2" title="Active Shop Floor Operations">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-slate-400" /> Active Shop Floor Operations
        </h3>
        <div className="divide-y divide-slate-100">
          <WOItem number="WO-2026-001" item="Alternator Rotor Assembly" qty={150} status="IN_PROGRESS" />
          <WOItem number="WO-2026-002" item="Engine Wiring Harness" qty={50} status="QUEUED" />
          <WOItem number="WO-2026-003" item="Radiator Mount Frame" qty={200} status="IN_PROGRESS" />
        </div>
      </WidgetContainer>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // PROCUREMENT MANAGER WIDGETS
  // ─────────────────────────────────────────────────────────────────────────
  const renderProcurementDashboard = () => (
    <div className="grid grid-cols-12 gap-6">
      {/* KPIs */}
      <WidgetContainer id="kpis" title="KPI metrics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Pending RFQ Quotes" value="6" subtitle="Awaiting supplier submission" icon={<ShoppingBag className="text-indigo-500" />} />
          <ApprovalsKPICard />
          <KPICard title="Late Purchase Orders" value="3" subtitle="Past expected delivery dates" icon={<Clock className="text-rose-500" />} trend="2 suppliers contacted" />
          <KPICard title="Supplier On-Time Rating" value="92.1%" subtitle="Enterprise average score" icon={<TrendingUp className="text-emerald-500" />} />
        </div>
      </WidgetContainer>

      {/* Supplier Issues */}
      <WidgetContainer id="sec1" title="Active Vendor Defect Logs">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-slate-400" /> Active Vendor Defect Logs
        </h3>
        <div className="space-y-3">
          <ExceptionItem title="Dimensional Deviation (Supreme Steel)" detail="Batch steel sheets failed QC thickness checks" urgency="high" />
          <ExceptionItem title="Transit Delay (Logistics Corp)" detail="PO-1102 delayed at regional customs hub" urgency="medium" />
          <ExceptionItem title="Tax Invoice Mismatch" detail="GSTIN validation failed for vendor invoice INV-8821" urgency="low" />
        </div>
      </WidgetContainer>

      {/* Pending PO Approvals List */}
      <WidgetContainer id="sec2" title="Pending Requisitions">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <ShoppingBag className="w-4 h-4 text-slate-400" /> Pending Requisitions
        </h3>
        <div className="divide-y divide-slate-100">
          <POItem id="REQ-0021" vendor="Procurement Dept" amount={145000} status="PENDING" />
          <POItem id="REQ-0022" vendor="R&D Engineering" amount={82000} status="DRAFT" />
          <POItem id="REQ-0023" vendor="Operations Core" amount={540000} status="PENDING" />
        </div>
      </WidgetContainer>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FINANCE MANAGER WIDGETS
  // ─────────────────────────────────────────────────────────────────────────
  const renderFinanceDashboard = () => (
    <div className="grid grid-cols-12 gap-6">
      {/* KPIs */}
      <WidgetContainer id="kpis" title="KPI metrics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Outstanding Payables" value={formatINR(2450000)} subtitle="Accounts Payable" icon={<CreditCard className="text-rose-500" />} />
          <KPICard title="Overdue Receivables" value={formatINR(1200000)} subtitle="Due from customers" icon={<TrendingUp className="text-emerald-500" />} />
          <KPICard title="Pending Payment Vouchers" value="5" subtitle="Require G/L release" icon={<Clock className="text-amber-500" />} />
          <KPICard title="Cash Position" value={formatINR(8900000)} subtitle="Across operational accounts" icon={<CreditCard className="text-blue-500" />} />
        </div>
      </WidgetContainer>

      {/* Outstanding Invoices */}
      <WidgetContainer id="sec1" title="Invoice Matching Inconsistencies">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-slate-400" /> Invoice Matching Inconsistencies
        </h3>
        <div className="space-y-3">
          <ExceptionItem title="3-Way Match Mismatch - INV-9021" detail="PO price is 1200, Invoice billed 1350" urgency="high" />
          <ExceptionItem title="GRN Quantity Discrepancy - INV-8821" detail="GRN received 100 units, Invoice billed 120 units" urgency="high" />
          <ExceptionItem title="Missing GRN link for INV-449" detail="Invoice uploaded without warehouse receipt linkage" urgency="medium" />
        </div>
      </WidgetContainer>

      {/* Ledger Summaries */}
      <WidgetContainer id="sec2" title="Recent Postings">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-slate-400" /> Recent Postings
        </h3>
        <div className="divide-y divide-slate-100">
          <PostingItem account="Accounts Payable (Sundry)" refNo="JV-2026-001" amount={-145000} type="debit" />
          <PostingItem account="Raw Material Inventory" refNo="JV-2026-001" amount={145000} type="credit" />
          <PostingItem account="Bank Operational Account" refNo="PV-2026-902" amount={-82000} type="debit" />
        </div>
      </WidgetContainer>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY MANAGER WIDGETS
  // ─────────────────────────────────────────────────────────────────────────
  const renderInventoryDashboard = () => (
    <div className="grid grid-cols-12 gap-6">
      {/* KPIs */}
      <WidgetContainer id="kpis" title="KPI metrics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Total Inventory Value" value={formatINR(4560000)} subtitle="On-hand warehouse stock" icon={<Box className="text-indigo-500" />} />
          <KPICard title="Warehouse Utilization" value="84%" subtitle="Main Vault (WH-01)" icon={<TrendingUp className="text-blue-500" />} />
          <KPICard title="Active Stock Shortages" value="4 SKU" subtitle="Below reorder threshold" icon={<AlertTriangle className="text-rose-500" />} severity="warning" />
          <KPICard title="Pending Receipts (GRN)" value="7 PO" subtitle="Awaiting dock delivery" icon={<Clock className="text-emerald-500" />} />
        </div>
      </WidgetContainer>

      {/* Stock Shortages List */}
      <WidgetContainer id="sec1" title="Low Stock Alerts">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-slate-400" /> Low Stock Alerts
        </h3>
        <div className="space-y-3">
          <ExceptionItem title="SKU-882 - Raw Steel Sheet" detail="Stock: 12 tons | Reorder point: 20 tons" urgency="high" />
          <ExceptionItem title="SKU-112 - M8 Hex Bolts" detail="Stock: 400 units | Reorder point: 1000 units" urgency="medium" />
          <ExceptionItem title="SKU-440 - Hydraulic Pump" detail="Stock: 2 units | Reorder point: 5 units" urgency="high" />
        </div>
      </WidgetContainer>

      {/* Warehouse Capacities */}
      <WidgetContainer id="sec2" title="Warehouse Capacities">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Box className="w-4 h-4 text-slate-400" /> Warehouse Capacities
        </h3>
        <div className="divide-y divide-slate-100">
          <CapacityItem name="Main Vault (WH-01)" capacity="84%" filled={84} type="Raw Materials" />
          <CapacityItem name="Secondary Vault (WH-02)" capacity="45%" filled={45} type="Finished Goods" />
          <CapacityItem name="Cold Storage (WH-03)" capacity="12%" filled={12} type="Chemicals" />
        </div>
      </WidgetContainer>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // EXECUTIVE WIDGETS
  // ─────────────────────────────────────────────────────────────────────────
  const renderExecutiveDashboard = () => (
    <div className="grid grid-cols-12 gap-6">
      {/* KPIs */}
      <WidgetContainer id="kpis" title="KPI metrics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Revenue (MTD)" value={formatINR(14200000)} subtitle="Sales Orders" icon={<TrendingUp className="text-emerald-500" />} trend="+12% YoY" />
          <KPICard title="Spend (MTD)" value={formatINR(6450000)} subtitle="Purchase Commitments" icon={<CreditCard className="text-blue-500" />} />
          <KPICard title="SLA Adherence Rate" value="98.2%" subtitle="Customer orders on-time" icon={<CheckCircle className="text-indigo-500" />} />
          <KPICard title="Active Staffing" value="120" subtitle="Across plants & offices" icon={<Users className="text-slate-500" />} />
        </div>
      </WidgetContainer>

      {/* Command Cockpit Graph mock */}
      <WidgetContainer id="sec1" title="Revenue vs Spend Trends">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-slate-400" /> Revenue vs Spend Trends
        </h3>
        <div className="h-48 flex items-end gap-3 justify-between pt-6">
          {[35, 60, 45, 80, 55, 90, 75, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-slate-100 rounded-lg flex flex-col justify-end overflow-hidden h-36">
                <div className="bg-emerald-500 w-full rounded-t-sm" style={{ height: `${h}%` }}></div>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Q{i + 1}</span>
            </div>
          ))}
        </div>
      </WidgetContainer>

      {/* Corporate Timeline */}
      <WidgetContainer id="sec2" title="System Activity Timeline">
        <SystemActivityTimelineWidget />
      </WidgetContainer>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN WIDGETS
  // ─────────────────────────────────────────────────────────────────────────
  const renderAdminDashboard = () => (
    <div className="grid grid-cols-12 gap-6">
      {/* KPIs */}
      <WidgetContainer id="kpis" title="KPI metrics">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="System CPU Load" value="12%" subtitle="Host VM environment" icon={<Database className="text-emerald-500" />} />
          <KPICard title="Reloader Status" value="ACTIVE" subtitle="Watching backend files" icon={<RefreshCw className="text-blue-500" />} />
          <KPICard title="Registered Users" value="24" subtitle="Active in database" icon={<Users className="text-indigo-500" />} />
          <KPICard title="Security Incidents" value="0" subtitle="Last 30 days logs" icon={<Key className="text-slate-500" />} />
        </div>
      </WidgetContainer>

      {/* System Health Logs */}
      <WidgetContainer id="sec1" title="Active System Threads">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-slate-400" /> Active System Threads
        </h3>
        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex justify-between">
            <span className="font-bold text-slate-600">Database Pool Status</span>
            <span className="font-extrabold text-emerald-600">OK (3 / 20 connections)</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="font-bold text-slate-600">Celery Task Reloader</span>
            <span className="font-extrabold text-emerald-600">RUNNING (Idle)</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="font-bold text-slate-600">Cache Memory Usage</span>
            <span className="font-extrabold text-blue-600">14.2 MB</span>
          </div>
        </div>
      </WidgetContainer>

      {/* User Roles Mapping */}
      <WidgetContainer id="sec2" title="Security Audit">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-slate-400" /> Security Audit
        </h3>
        <div className="space-y-3">
          <ExceptionItem title="Role Mapping Success" detail="User logged in via administrative context" urgency="low" />
          <ExceptionItem title="Alembic Migration Verification" detail="Schema matching exactly 100% database models configuration" urgency="low" />
        </div>
      </WidgetContainer>
    </div>
  );

  return (
    <StandardPageFramework
      title="Enterprise Command Cockpit"
      description={`Welcome back. You are viewing the workspace configured for your role.`}
      actions={
        <div className="flex items-center gap-3">
          {/* Layout customizer triggers */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
            <button
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded transition ${
                isCustomizing ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              {isCustomizing ? 'Exit Customizer' : 'Customize Layout'}
            </button>
            {isCustomizing && (
              <button
                onClick={resetLayout}
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded hover:bg-rose-50 text-rose-600 transition"
              >
                Reset Default
              </button>
            )}
          </div>

          {SHOW_DEV_SWITCHER && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Demo Switcher:</span>
              <select
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="ADMIN">System Admin</option>
                <option value="PROCUREMENT_MANAGER">Procurement Manager</option>
                <option value="WAREHOUSE_MANAGER">Inventory Manager</option>
                <option value="EMPLOYEE">Production Manager</option>
                <option value="FINANCE_MANAGER">Finance Manager</option>
                <option value="EXECUTIVE">Executive / Owner</option>
              </select>
            </div>
          )}
        </div>
      }
    >
      <div className="p-6 bg-slate-50 space-y-6">
        {renderDashboardWidgets()}
      </div>
    </StandardPageFramework>
  );
}


// ─── Child Presentational Components ────────────────────────────────────────

function KPICard({ title, value, subtitle, icon, trend, severity = "info" }: any) {
  const getSeverityStyles = () => {
    if (severity === 'warning') return 'bg-amber-50/50 border-amber-100';
    if (severity === 'danger') return 'bg-rose-50/50 border-rose-100';
    if (severity === 'success') return 'bg-emerald-50/50 border-emerald-100';
    return 'bg-white border-slate-200';
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md ${getSeverityStyles()}`}>
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
        </div>
        <div className="p-2 rounded-xl bg-slate-100/80">{icon}</div>
      </div>
      <div className="flex justify-between items-center mt-3 text-[10px] font-semibold text-slate-500">
        <span>{subtitle}</span>
        {trend && <span className="text-emerald-600 font-bold">{trend}</span>}
      </div>
    </div>
  );
}

function ExceptionItem({ title, detail, urgency }: any) {
  const getBadge = () => {
    if (urgency === 'high') return <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-extrabold uppercase">Critical</span>;
    if (urgency === 'medium') return <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-extrabold uppercase">Warning</span>;
    return <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-extrabold uppercase">Info</span>;
  };
  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start gap-4 text-xs font-semibold">
      <div>
        <div className="text-slate-800 font-extrabold">{title}</div>
        <div className="text-slate-500 text-[10px] mt-0.5">{detail}</div>
      </div>
      {getBadge()}
    </div>
  );
}

function WOItem({ number, item, qty, status }: any) {
  return (
    <div className="py-2.5 flex justify-between items-center text-xs font-semibold">
      <div>
        <div className="text-slate-900 font-extrabold">{number}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{item}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-slate-600">Qty: {qty}</span>
        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span>
      </div>
    </div>
  );
}

function POItem({ id, vendor, amount, status }: any) {
  return (
    <div className="py-2.5 flex justify-between items-center text-xs font-semibold">
      <div>
        <div className="text-slate-900 font-extrabold">{id}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{vendor}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-slate-700 font-bold">₹{amount.toLocaleString('en-IN')}</span>
        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{status}</span>
      </div>
    </div>
  );
}

function PostingItem({ account, refNo, amount, type }: any) {
  return (
    <div className="py-2.5 flex justify-between items-center text-xs font-semibold">
      <div>
        <div className="text-slate-800 font-bold">{account}</div>
        <div className="text-[9px] text-slate-400 mt-0.5">Ref: {refNo}</div>
      </div>
      <span className={`font-extrabold ${type === 'credit' ? 'text-emerald-600' : 'text-slate-800'}`}>
        {amount > 0 ? '+' : ''}₹{amount.toLocaleString('en-IN')}
      </span>
    </div>
  );
}

function CapacityItem({ name, capacity, filled, type }: any) {
  return (
    <div className="py-2.5 text-xs font-semibold">
      <div className="flex justify-between items-center mb-1">
        <span className="text-slate-700 font-extrabold">{name}</span>
        <span className="text-slate-400 text-[10px]">{type}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${filled > 80 ? 'bg-rose-500' : filled > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${filled}%` }} />
        </div>
        <span className="text-[10px] font-bold text-slate-600">{capacity}</span>
      </div>
    </div>
  );
}
