import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, FileUp, Loader2, FileText, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import {
  getInvoices,
  createInvoice,
  getPOs,
  getGRNs,
  uploadAttachment,
} from '../../api';

interface Invoice {
  id: string;
  invoice_number: string;
  po_reference?: string;
  po_id?: string;
  grn_id?: string;
  amount: number;
  status: string;
  date: string;
  remarks?: string;
}

interface PO {
  id: string;
  po_number: string;
}

interface GRN {
  id: string;
  grn_number: string;
}

type InvoiceStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Paid: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-700',
};

const INITIAL_FORM = {
  invoice_number: '',
  po_id: '',
  grn_id: '',
  amount: '',
  date: '',
  remarks: '',
};

const VendorInvoiceCenter: React.FC = () => {
  const { user } = useAuthStore();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState(INITIAL_FORM);
  const [file, setFile] = useState<File | null>(null);

  const [pos, setPos] = useState<PO[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInvoices();
      setInvoices(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const openForm = async () => {
    setShowForm(true);
    setDropdownsLoading(true);
    try {
      const [poData, grnData] = await Promise.all([getPOs(), getGRNs()]);
      setPos(Array.isArray(poData) ? poData : poData.results ?? []);
      setGrns(Array.isArray(grnData) ? grnData : grnData.results ?? []);
    } catch {
      toast.error('Failed to load PO/GRN options');
    } finally {
      setDropdownsLoading(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(INITIAL_FORM);
    setFile(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.invoice_number.trim()) {
      toast.error('Invoice number is required');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!form.date) {
      toast.error('Invoice date is required');
      return;
    }

    setSubmitting(true);
    try {
      let attachment_id: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_type', 'invoice');
        const uploadRes = await uploadAttachment(formData);
        attachment_id = uploadRes.id;
      }

      const payload = {
        invoice_number: form.invoice_number.trim(),
        po_id: form.po_id || undefined,
        grn_id: form.grn_id || undefined,
        amount: parseFloat(form.amount),
        date: form.date,
        remarks: form.remarks.trim() || undefined,
        attachment_id,
        vendor_id: user?.vendor_id,
      };

      await createInvoice(payload);
      toast.success('Invoice submitted successfully');
      closeForm();
      fetchInvoices();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.po_reference?.toLowerCase().includes(q) ||
      inv.status?.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

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

  const getStatusBadge = (status: string) => {
    const style = STATUS_STYLES[status as InvoiceStatus] ?? 'bg-gray-100 text-gray-700';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Center</h1>
          <p className="text-sm text-gray-500 mt-1">Submit and track your invoices</p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search invoices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading invoices...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium text-gray-500">No invoices found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery ? 'Try a different search term' : 'Click "New Invoice" to create one'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Invoice Number</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">PO Reference</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-gray-600">{inv.po_reference ?? '—'}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(inv.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Invoice Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New Invoice</h2>
              <button
                onClick={closeForm}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Invoice Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="invoice_number"
                  value={form.invoice_number}
                  onChange={handleChange}
                  placeholder="e.g. INV-2026-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Linked PO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked PO</label>
                {dropdownsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : (
                  <select
                    name="po_id"
                    value={form.po_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">Select a Purchase Order</option>
                    {pos.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.po_number}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Linked GRN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked GRN</label>
                {dropdownsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : (
                  <select
                    name="grn_id"
                    value={form.grn_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">Select a GRN</option>
                    {grns.map((grn) => (
                      <option key={grn.id} value={grn.id}>
                        {grn.grn_number}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachment</label>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                  <FileUp className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {file ? file.name : 'Click to upload a file'}
                  </span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  />
                </label>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any additional notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Submitting...' : 'Submit Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorInvoiceCenter;
