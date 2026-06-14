import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, IndianRupee, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { getLiabilities } from '../../api';

interface Liability {
  id: string;
  invoice_ref: string;
  invoice_id?: string;
  amount: number;
  due_date: string;
  payment_status: string;
  payment_date?: string;
  vendor_id?: string;
}

type PaymentStatus = 'Approved' | 'Scheduled' | 'Paid' | 'Blocked';

const STATUS_STYLES: Record<PaymentStatus, string> = {
  Approved: 'bg-blue-100 text-blue-700',
  Scheduled: 'bg-amber-100 text-amber-700',
  Paid: 'bg-green-100 text-green-700',
  Blocked: 'bg-red-100 text-red-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const isThisWeek = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return date >= startOfWeek && date < endOfWeek;
};

const isThisMonth = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

const VendorPaymentTracker: React.FC = () => {
  const { user } = useAuthStore();

  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLiabilities({ vendor_id: user?.vendor_id });
      const data = res.data;
      setLiabilities(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      toast.error('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, [user?.vendor_id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const summaries = useMemo(() => {
    const outstanding = liabilities
      .filter((l) => l.payment_status !== 'Paid')
      .reduce((sum, l) => sum + l.amount, 0);

    const dueThisWeek = liabilities
      .filter((l) => l.payment_status !== 'Paid' && isThisWeek(l.due_date))
      .reduce((sum, l) => sum + l.amount, 0);

    const paidThisMonth = liabilities
      .filter((l) => l.payment_status === 'Paid' && l.payment_date && isThisMonth(l.payment_date))
      .reduce((sum, l) => sum + l.amount, 0);

    return { outstanding, dueThisWeek, paidThisMonth };
  }, [liabilities]);

  const filteredLiabilities =
    statusFilter === 'All'
      ? liabilities
      : liabilities.filter((l) => l.payment_status === statusFilter);

  const getStatusBadge = (status: string) => {
    const style = STATUS_STYLES[status as PaymentStatus] ?? 'bg-gray-100 text-gray-700';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
        {status}
      </span>
    );
  };

  const summaryCards = [
    {
      label: 'Total Outstanding',
      value: summaries.outstanding,
      icon: IndianRupee,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
    },
    {
      label: 'Due This Week',
      value: summaries.dueThisWeek,
      icon: CalendarClock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Paid This Month',
      value: summaries.paidThisMonth,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">Track your invoice payments and outstanding amounts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bg} ${card.border} border rounded-xl p-5 flex items-start gap-4`}
          >
            <div className={`p-2.5 rounded-lg bg-white shadow-sm`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p className={`text-xl font-bold ${card.color} mt-0.5`}>{formatCurrency(card.value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {['All', 'Approved', 'Scheduled', 'Paid', 'Blocked'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading payments...</span>
          </div>
        ) : filteredLiabilities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <AlertTriangle className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium text-gray-500">No payment records found</p>
            <p className="text-xs text-gray-400 mt-1">
              {statusFilter !== 'All'
                ? `No payments with status "${statusFilter}"`
                : 'Payment records will appear here once invoices are processed'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Invoice Ref</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Due Date</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLiabilities.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.invoice_ref}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(item.due_date)}</td>
                    <td className="px-6 py-4">{getStatusBadge(item.payment_status)}</td>
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

export default VendorPaymentTracker;
