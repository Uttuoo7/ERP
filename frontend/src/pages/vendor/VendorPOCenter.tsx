import React, { useState, useEffect, useCallback } from 'react';
import { Package, FileText, CheckCircle2, XCircle, HelpCircle, Loader2, Search, Calendar, FileCheck2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { getVendorPOs, acknowledgeVendorPO } from '../../api';

interface POLine {
  id: string;
  item: {
    sku: string;
    name: string;
  };
  quantity: number;
  uom: string;
  unit_price: number;
  total_price: number;
}

interface PO {
  id: string;
  po_number: string;
  order_date: string;
  expected_delivery_date?: string;
  total_amount: number;
  status: string;
  workflow_state: string;
  payment_terms?: string;
  delivery_terms?: string;
  remarks?: string;
  line_items?: POLine[];
}

const VendorPOCenter: React.FC = () => {
  const { user } = useAuthStore();

  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPo, setSelectedPo] = useState<PO | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [actioning, setActioning] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [remarksText, setRemarksText] = useState('');

  const fetchPOs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getVendorPOs();
      const list = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.results || [];
      setPos(list);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  const handleSelectPo = async (po: PO) => {
    setSelectedPo(po);
    setRemarksText('');
  };

  const handleAcknowledge = async () => {
    if (!selectedPo) return;
    setActioning(true);
    try {
      await acknowledgeVendorPO(selectedPo.id);
      toast.success('Purchase Order acknowledged successfully');
      
      // Update locally
      setSelectedPo(prev => prev ? { ...prev, status: 'ISSUED' } : null);
      fetchPOs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to acknowledge Purchase Order');
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo || !remarksText.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setActioning(true);
    try {
      // Mocking rejection backend transaction
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Purchase Order rejection dispatched to purchasing head');
      setShowRejectModal(false);
      
      // Update status locally for UI representation
      setSelectedPo(prev => prev ? { ...prev, status: 'REJECTED' } : null);
    } catch {
      toast.error('Failed to register rejection');
    } finally {
      setActioning(false);
    }
  };

  const handleClarify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo || !remarksText.trim()) {
      toast.error('Please specify what details require clarification');
      return;
    }
    setActioning(true);
    try {
      // Mocking clarification request transaction
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Clarification request logged and dispatched to buyer');
      setShowClarifyModal(false);
    } catch {
      toast.error('Failed to submit clarification query');
    } finally {
      setActioning(false);
    }
  };

  const filteredPos = pos.filter(po => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return po.po_number?.toLowerCase().includes(q) || po.status?.toLowerCase().includes(q);
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ISSUED': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'PARTIAL_RECEIPT': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'FULFILLED': return 'bg-green-100 text-green-700 border-green-200';
      case 'REJECTED': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
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

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
        <p className="text-sm text-slate-500 mt-1">Review, acknowledge, and track purchase orders issued to your organization</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: List pane */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search POs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-350 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          ) : filteredPos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <Package className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">No purchase orders found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredPos.map((po) => {
                const isSelected = selectedPo?.id === po.id;
                const needsAck = po.status === 'DRAFT';
                return (
                  <button
                    key={po.id}
                    onClick={() => handleSelectPo(po)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{po.po_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(po.status)}`}>
                        {po.status === 'DRAFT' ? 'Needs Acknowledgment' : po.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 mt-3">
                      <span>Date: {formatDate(po.order_date)}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(po.total_amount)}</span>
                    </div>
                    {needsAck && (
                      <div className="mt-2.5 flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded">
                        <FileCheck2 className="w-3.5 h-3.5" /> Action Required: Pending Acknowledgment
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Detail pane */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[50vh]">
          {!selectedPo ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 text-center p-6">
              <Package className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">Select a Purchase Order from the list to view particulars</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedPo.po_number}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Order Date: {formatDate(selectedPo.order_date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusStyle(selectedPo.status)}`}>
                    {selectedPo.status === 'DRAFT' ? 'Needs Acknowledgment' : selectedPo.status}
                  </span>
                </div>
              </div>

              {/* Delivery and payment terms */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs font-medium">
                <div>
                  <p className="text-slate-400">Payment Terms</p>
                  <p className="text-slate-800 font-bold mt-1">{selectedPo.payment_terms || 'Standard Net 30'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Delivery Terms</p>
                  <p className="text-slate-800 font-bold mt-1">{selectedPo.delivery_terms || 'EXW / CIF'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Expected Delivery</p>
                  <p className="text-slate-800 font-bold mt-1">{formatDate(selectedPo.expected_delivery_date)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Total Value</p>
                  <p className="text-indigo-600 font-black mt-1 text-sm">{formatCurrency(selectedPo.total_amount)}</p>
                </div>
              </div>

              {selectedPo.remarks && (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-650">
                  <span className="font-bold text-slate-700 block mb-0.5">Order Specifications:</span>
                  {selectedPo.remarks}
                </div>
              )}

              {/* Line Items */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Order Lines</h3>
                <div className="border border-slate-150 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 font-bold text-slate-500">
                        <th className="px-4 py-2.5">SKU / Item</th>
                        <th className="px-4 py-2.5 text-center">Qty</th>
                        <th className="px-4 py-2.5 text-center">UOM</th>
                        <th className="px-4 py-2.5 text-right">Unit Price</th>
                        <th className="px-4 py-2.5 text-right">Total Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                      {selectedPo.line_items?.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50/40">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 block">{line.item.sku}</span>
                            <span className="text-slate-400 font-normal">{line.item.name}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">{line.quantity}</td>
                          <td className="px-4 py-3 text-center text-slate-400">{line.uom}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(line.unit_price)}</td>
                          <td className="px-4 py-3 text-right text-slate-900 font-black">{formatCurrency(line.total_price)}</td>
                        </tr>
                      ))}
                      {(!selectedPo.line_items || selectedPo.line_items.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No line items linked to this PO</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedPo.status === 'DRAFT' && (
                <div className="border-t border-slate-100 pt-6 flex flex-wrap gap-3 justify-end">
                  <button
                    onClick={() => {
                      setRemarksText('');
                      setShowClarifyModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    Request Clarification
                  </button>

                  <button
                    onClick={() => {
                      setRemarksText('');
                      setShowRejectModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Order
                  </button>

                  <button
                    onClick={handleAcknowledge}
                    disabled={actioning}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-55 shadow-md shadow-indigo-600/10"
                  >
                    {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Acknowledge Purchase Order
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Reject PO Modal --- */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl max-w-md w-full space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Reject Purchase Order</h3>
              <p className="text-xs text-slate-400 mt-1">Specify your reasons for rejecting PO {selectedPo?.po_number}. Rejection alerts the purchasing officer.</p>
            </div>

            <form onSubmit={handleReject} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="block text-slate-500 uppercase tracking-wider text-[10px]">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  placeholder="Pricing discrepancy, incorrect delivery terms, unit of measure mismatches..."
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-350 rounded-lg outline-none focus:border-indigo-500 bg-white text-slate-700 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actioning}
                  className="px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Clarify PO Modal --- */}
      {showClarifyModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl max-w-md w-full space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Request PO Clarification</h3>
              <p className="text-xs text-slate-400 mt-1">Submit your queries regarding PO {selectedPo?.po_number}. The buyer agent will respond to address details.</p>
            </div>

            <form onSubmit={handleClarify} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="block text-slate-500 uppercase tracking-wider text-[10px]">Query / Clarification Details <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  placeholder="Specify details or questions requiring buyer attention..."
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-350 rounded-lg outline-none focus:border-indigo-500 bg-white text-slate-700 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowClarifyModal(false)}
                  className="px-4 py-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actioning}
                  className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HelpCircle className="w-3.5 h-3.5" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorPOCenter;
