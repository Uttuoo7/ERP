import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, FileText, Send, Loader2, CheckCircle, Clock, AlertCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { getVendorRFQs, getVendorRFQDetails, submitVendorRFQQuotation } from '../../api';

interface RFQLine {
  id: string;
  item: {
    sku: string;
    name: string;
  };
  quantity: number;
  uom: string;
  estimated_budget: number;
}

interface Invitation {
  id: string;
  vendor: {
    id: string;
    name: string;
  };
  invitation_status: string;
  invited_date: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  total_quoted_price: number;
  lead_time_days: number;
  remarks?: string;
  is_selected: boolean;
  vendor: {
    id: string;
    name: string;
  };
}

interface RFQ {
  id: string;
  rfq_number: string;
  due_date: string;
  currency: string;
  payment_terms?: string;
  delivery_terms?: string;
  remarks?: string;
  status: string;
  line_items: RFQLine[];
  invitations: Invitation[];
  quotations: Quotation[];
}

const VendorRFQCenter: React.FC = () => {
  const { user } = useAuthStore();
  const vendorId = user?.id?.toString() || '';

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Bid Form States
  const [quoteNumber, setQuoteNumber] = useState('');
  const [leadTime, setLeadTime] = useState(7);
  const [remarks, setRemarks] = useState('');
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchRfqs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getVendorRFQs();
      const list = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.results || [];
      setRfqs(list);
    } catch {
      toast.error('Failed to load RFQ invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRfqs();
  }, [fetchRfqs]);

  const handleSelectRfq = useCallback(async (rfqId: string) => {
    try {
      setDetailsLoading(true);
      const res = await getVendorRFQDetails(rfqId);
      const rfqDetails = res.data;
      setSelectedRfq(rfqDetails);

      // Pre-populate quotation form values
      setQuoteNumber(`QT-${Math.floor(1000 + Math.random() * 9000)}`);
      setLeadTime(7);
      setRemarks('');
      
      const initialPrices: Record<string, string> = {};
      rfqDetails.line_items?.forEach((l: RFQLine) => {
        initialPrices[l.id] = '';
      });
      setBidPrices(initialPrices);
    } catch {
      toast.error('Failed to load RFQ details');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfq) return;
    if (!quoteNumber.trim()) {
      toast.error('Quotation number is required');
      return;
    }

    const missingPrices = selectedRfq.line_items.some(l => !bidPrices[l.id] || parseFloat(bidPrices[l.id]) <= 0);
    if (missingPrices) {
      toast.error('Please enter a valid unit price for all items');
      return;
    }

    setSubmitting(true);
    try {
      const lineItems = selectedRfq.line_items.map(l => ({
        rfq_line_id: l.id,
        unit_price: parseFloat(bidPrices[l.id]),
        tax_rate: 0.0,
        discount_rate: 0.0,
        lead_time_days: Number(leadTime),
        vendor_remarks: ''
      }));

      const payload = {
        quotation_number: quoteNumber.trim(),
        taxes: 0.0,
        discounts: 0.0,
        lead_time_days: Number(leadTime),
        delivery_commitment: 'Committed',
        payment_terms: selectedRfq.payment_terms || 'Standard Net 30',
        validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        remarks: remarks.trim() || null,
        line_items: lineItems
      };

      await submitVendorRFQQuotation(selectedRfq.id, payload);
      toast.success('Quotation submitted successfully!');
      
      // Refresh details to show submitted status
      const updatedRes = await getVendorRFQDetails(selectedRfq.id);
      setSelectedRfq(updatedRes.data);
      fetchRfqs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit quotation');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRfqs = rfqs.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.rfq_number?.toLowerCase().includes(q) || r.status?.toLowerCase().includes(q);
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-700';
      case 'SENT': return 'bg-indigo-100 text-indigo-700';
      case 'PARTIALLY_RESPONDED': return 'bg-amber-100 text-amber-700 animate-pulse';
      case 'FULLY_RESPONDED': return 'bg-blue-100 text-blue-700';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-750';
    }
  };

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

  // Check if current vendor already responded
  const submittedQuotation = selectedRfq?.quotations?.find(
    q => q.vendor?.id?.toString() === vendorId || q.vendor?.name?.toLowerCase().includes('supplier')
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">RFQ Inbox</h1>
        <p className="text-sm text-slate-500 mt-1">Review requests for quotations and submit pricing proposals</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: List pane */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search RFQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-350 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          ) : filteredRfqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <Inbox className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">No RFQs found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredRfqs.map((rfq) => {
                const isSelected = selectedRfq?.id === rfq.id;
                return (
                  <button
                    key={rfq.id}
                    onClick={() => handleSelectRfq(rfq.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{rfq.rfq_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusStyle(rfq.status)}`}>
                        {rfq.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                      <span>Due: {formatDate(rfq.due_date)}</span>
                      <span className="font-semibold text-indigo-600">{rfq.currency}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Detail pane */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[50vh]">
          {detailsLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
              <p className="text-sm">Loading RFQ details...</p>
            </div>
          ) : !selectedRfq ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 text-center p-6">
              <Inbox className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">Select an RFQ from the list to view specifications</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* RFQ Meta Details */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedRfq.rfq_number}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Due Date: {formatDate(selectedRfq.due_date)}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${getStatusStyle(selectedRfq.status)}`}>
                  {selectedRfq.status}
                </span>
              </div>

              {/* Terms Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs font-medium">
                <div>
                  <p className="text-slate-400">Payment Terms</p>
                  <p className="text-slate-800 font-bold mt-1">{selectedRfq.payment_terms || 'Standard Net 30'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Delivery Terms</p>
                  <p className="text-slate-800 font-bold mt-1">{selectedRfq.delivery_terms || 'CIF / EXW'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Currency</p>
                  <p className="text-slate-800 font-bold mt-1">{selectedRfq.currency}</p>
                </div>
                <div>
                  <p className="text-slate-400">Close Date</p>
                  <p className="text-slate-800 font-bold mt-1">{formatDate(selectedRfq.due_date)}</p>
                </div>
              </div>

              {selectedRfq.remarks && (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-600">
                  <span className="font-bold text-slate-700 block mb-0.5">Buyer Notes:</span>
                  {selectedRfq.remarks}
                </div>
              )}

              {/* Items Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Requested Items</h3>
                <div className="border border-slate-150 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 font-bold text-slate-500">
                        <th className="px-4 py-2.5">SKU / Item</th>
                        <th className="px-4 py-2.5 text-center">Quantity</th>
                        <th className="px-4 py-2.5 text-center">UOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedRfq.line_items?.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50/40">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 block">{line.item.sku}</span>
                            <span className="text-slate-500">{line.item.name}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">{line.quantity}</td>
                          <td className="px-4 py-3 text-center text-slate-400">{line.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quotation Submission Status / Form */}
              <div className="border-t border-slate-100 pt-6">
                {submittedQuotation ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Quotation Submitted</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        You have already responded to this RFQ with quotation reference{' '}
                        <span className="font-bold">{submittedQuotation.quotation_number}</span>.
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-3 text-xs text-emerald-700">
                        <div>
                          <span className="block font-medium">Quote Price:</span>
                          <span className="font-bold text-emerald-800">
                            {selectedRfq.currency} {submittedQuotation.total_quoted_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="block font-medium">Lead Time:</span>
                          <span className="font-bold text-emerald-800">{submittedQuotation.lead_time_days} Days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleBidSubmit} className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Submit Quotation Proposal</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Quote Number Reference <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={quoteNumber}
                          onChange={(e) => setQuoteNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Lead Time (Days) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={leadTime}
                          onChange={(e) => setLeadTime(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* Price Row Grid */}
                    <div className="space-y-2.5">
                      <span className="block text-xs font-medium text-slate-500">Unit Price Quotation</span>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {selectedRfq.line_items?.map((line) => (
                          <div
                            key={line.id}
                            className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800 block">{line.item.sku}</span>
                              <span className="text-slate-500 text-[10px]">
                                Requested Qty: {line.quantity} {line.uom}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-bold">{selectedRfq.currency}</span>
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                value={bidPrices[line.id] || ''}
                                onChange={(e) =>
                                  setBidPrices((prev) => ({ ...prev, [line.id]: e.target.value }))
                                }
                                className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white font-semibold text-right"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Remarks */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Quotation Remarks</label>
                      <input
                        type="text"
                        placeholder="Inclusions, payment schedules, or freight details..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-600/10"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Submit Quotation Sheet
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorRFQCenter;
