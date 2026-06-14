import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Inbox,
  Package,
  FileText,
  DollarSign,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRFQs, getPOs, getInvoices, getLiabilities } from '../../api';
import { useAuthStore } from '../../store/authStore';

interface KPICard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
  change?: string;
}

interface ActivityEvent {
  id: string;
  type: 'rfq' | 'po' | 'invoice' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
}

export default function VendorDashboard() {
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [openRFQs, setOpenRFQs] = useState(0);
  const [activePOs, setActivePOs] = useState(0);
  const [pendingInvoices, setPendingInvoices] = useState(0);
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);

  const buildActivityFeed = useCallback(
    (rfqs: any[], pos: any[], invoices: any[]): ActivityEvent[] => {
      const events: ActivityEvent[] = [];

      rfqs.slice(0, 5).forEach((rfq: any) => {
        events.push({
          id: `rfq-${rfq.id}`,
          type: 'rfq',
          title: `RFQ ${rfq.rfq_number || rfq.id}`,
          description: rfq.title || 'New quotation request received',
          timestamp: rfq.created_at || rfq.updated_at || new Date().toISOString(),
          icon: <Inbox className="w-4 h-4" />,
          color: 'text-indigo-600 bg-indigo-50',
        });
      });

      pos.slice(0, 5).forEach((po: any) => {
        events.push({
          id: `po-${po.id}`,
          type: 'po',
          title: `PO ${po.po_number || po.id}`,
          description: `Purchase order — ${po.status || 'Processing'}`,
          timestamp: po.created_at || po.updated_at || new Date().toISOString(),
          icon: <Package className="w-4 h-4" />,
          color: 'text-blue-600 bg-blue-50',
        });
      });

      invoices.slice(0, 5).forEach((inv: any) => {
        events.push({
          id: `inv-${inv.id}`,
          type: 'invoice',
          title: `Invoice ${inv.invoice_number || inv.id}`,
          description: `Status: ${inv.status || 'Submitted'}`,
          timestamp: inv.created_at || inv.updated_at || new Date().toISOString(),
          icon: <FileText className="w-4 h-4" />,
          color: 'text-emerald-600 bg-emerald-50',
        });
      });

      events.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return events.slice(0, 5);
    },
    []
  );

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [rfqRes, poRes, invRes, liabRes] = await Promise.allSettled([
          getRFQs({ status: 'OPEN' }),
          getPOs(),
          getInvoices({ status: 'PENDING' }),
          getLiabilities(),
        ]);

        const rfqs =
          rfqRes.status === 'fulfilled'
            ? Array.isArray(rfqRes.value.data) ? rfqRes.value.data : rfqRes.value.data?.items || []
            : [];
        const pos =
          poRes.status === 'fulfilled'
            ? Array.isArray(poRes.value.data) ? poRes.value.data : poRes.value.data?.items || []
            : [];
        const invoices =
          invRes.status === 'fulfilled'
            ? Array.isArray(invRes.value.data) ? invRes.value.data : invRes.value.data?.items || []
            : [];
        const liabilities =
          liabRes.status === 'fulfilled'
            ? Array.isArray(liabRes.value.data) ? liabRes.value.data : liabRes.value.data?.items || []
            : [];

        setOpenRFQs(rfqs.length);
        setActivePOs(pos.filter((p: any) => ['ISSUED', 'APPROVED', 'ACTIVE'].includes(p.status)).length);
        setPendingInvoices(invoices.length);

        const totalOutstanding = liabilities.reduce(
          (sum: number, l: any) => sum + (Number(l.balance_due ?? l.amount ?? 0)),
          0
        );
        setOutstandingAmount(totalOutstanding);

        setRecentActivity(buildActivityFeed(rfqs, pos, invoices));
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [buildActivityFeed]);

  const kpis: KPICard[] = [
    {
      label: 'Open RFQs',
      value: openRFQs,
      icon: <Inbox className="w-6 h-6" />,
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Active POs',
      value: activePOs,
      icon: <Package className="w-6 h-6" />,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Pending Invoices',
      value: pendingInvoices,
      icon: <FileText className="w-6 h-6" />,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Outstanding Payments',
      value: `₹${outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: <DollarSign className="w-6 h-6" />,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-slate-500 text-sm">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.email && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Signed in as <span className="font-medium text-slate-700">{user.email}</span>
            </span>
          )}
        </p>
      </div>

      {/* KPI Cards – 2×2 grid (or 2×3 on larger screens) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div>
              <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{kpi.value}</p>
            </div>
            <div className={`p-3 rounded-xl ${kpi.bgColor}`}>
              <span className={kpi.iconColor}>{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Row – Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { label: 'View RFQ Inbox', path: '/portal/rfqs', icon: <Inbox className="w-4 h-4" /> },
              { label: 'Purchase Orders', path: '/portal/pos', icon: <Package className="w-4 h-4" /> },
              { label: 'Submit Invoice', path: '/portal/invoices', icon: <FileText className="w-4 h-4" /> },
            ].map((action) => (
              <a
                key={action.label}
                href={action.path}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
              >
                <span className="text-slate-500 group-hover:text-indigo-600">{action.icon}</span>
                <span className="flex-1 text-sm font-medium text-slate-700 group-hover:text-indigo-700">
                  {action.label}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
              </a>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Inbox className="w-10 h-10 mb-3" />
              <p className="text-sm">No recent activity to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${event.color}`}>{event.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{event.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
