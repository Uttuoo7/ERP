import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, FileText, CheckCircle, Clock, XCircle, Plus, Send, RefreshCw, Loader2, Star, Award, Sparkles, Building, ListCollapse, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getRFQ, getVendors, inviteRFQVendors, submitRFQQuotation 
} from "../api";
import DocumentTraceabilityTimeline from '../components/DocumentTraceabilityTimeline';

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
  buyer: {
    first_name: string;
    last_name: string;
  };
  line_items: RFQLine[];
  invitations: Invitation[];
  quotations: Quotation[];
}

const RFQDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);

  // Invite Vendor Modal States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");

  // Submit Bid Modal States
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidVendorId, setBidVendorId] = useState("");
  const [bidNumber, setBidNumber] = useState("");
  const [bidLeadTime, setBidLeadTime] = useState(7);
  const [bidRemarks, setBidRemarks] = useState("");
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({}); // rfq_line_id -> price

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await getRFQ(id!);
      setRfq(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  const handleOpenInvite = async () => {
    setShowInviteModal(true);
    try {
      const res = await getVendors();
      // Filter out vendors that are already invited
      const currentInvited = rfq?.invitations.map(i => i.vendor.id) || [];
      const uninvited = res.data.filter((v: any) => !currentInvited.includes(v.id));
      setVendorsList(uninvited);
      if (uninvited.length > 0) {
        setSelectedVendorId(uninvited[0].id);
      }
    } catch (err) {
      toast.error("Failed to load supplier lists.");
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return;

    setActioning(true);
    try {
      await inviteRFQVendors(id!, [selectedVendorId]);
      toast.success("Supplier invited successfully!");
      setShowInviteModal(false);
      fetchDetails();
    } catch (err) {
      // Handled
    } finally {
      setActioning(false);
    }
  };

  const handleOpenBid = (vendorId: string) => {
    setBidVendorId(vendorId);
    setBidNumber(`QT-${Math.floor(1000 + Math.random() * 9000)}`);
    setBidLeadTime(7);
    setBidRemarks("");
    
    // Initialize price map
    const initialPrices: Record<string, string> = {};
    rfq?.line_items.forEach(l => {
      initialPrices[l.id] = "";
    });
    setBidPrices(initialPrices);
    setShowBidModal(true);
  };

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidNumber.trim()) {
      toast.error("Quotation reference number is required.");
      return;
    }

    // Convert bid prices
    const lineItems = Object.entries(bidPrices).map(([lineId, price]) => ({
      rfq_line_id: lineId,
      unit_price: parseFloat(price) || 0.0,
      tax_rate: 0.0,
      discount_rate: 0.0,
      lead_time_days: Number(bidLeadTime),
      vendor_remarks: ""
    }));

    setActioning(true);
    try {
      const payload = {
        quotation_number: bidNumber,
        taxes: 0.0,
        discounts: 0.0,
        lead_time_days: Number(bidLeadTime),
        delivery_commitment: "Committed",
        payment_terms: "Standard Net 30",
        validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        remarks: bidRemarks || null,
        line_items: lineItems
      };

      await submitRFQQuotation(id!, bidVendorId, payload);
      toast.success("Vendor quote submitted successfully!");
      setShowBidModal(false);
      fetchDetails();
    } catch (err) {
      // Handled
    } finally {
      setActioning(false);
    }
  };

  if (loading && !rfq) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Resolving RFQ folders...</p>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-bold text-slate-900">RFQ Not Found</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
      case "SENT":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">Sent</span>;
      case "PARTIALLY_RESPONDED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">Partially Responded</span>;
      case "FULLY_RESPONDED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Fully Responded</span>;
      case "APPROVED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Contract Awarded</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-750">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/rfqs')}
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 leading-none">{rfq.rfq_number}</h1>
              {getStatusBadge(rfq.status)}
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-1">Managed by Buyer Agent {rfq.buyer.first_name} {rfq.buyer.last_name}</p>
          </div>
        </div>

        {rfq.quotations.length > 0 && (
          <Link
            to={`/rfqs/${rfq.id}/compare`}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/10"
          >
            <Sparkles className="w-4.5 h-4.5" />
            Evaluate Comparison Matrix
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Admin Specs & Lines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
              <ListCollapse className="w-4 h-4 text-blue-600" /> RFQ Logistics & Terms
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Response Deadline</span>
                <span className="text-slate-800 font-black">{new Date(rfq.due_date).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Payment Terms</span>
                <span className="text-slate-800 font-bold">{rfq.payment_terms || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Delivery Terms</span>
                <span className="text-slate-800 font-bold">{rfq.delivery_terms || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 py-1.5">
                <span className="font-bold uppercase tracking-wider text-slate-400">Default Currency</span>
                <span className="text-slate-800 font-black">{rfq.currency}</span>
              </div>
            </div>

            {rfq.remarks && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-semibold text-slate-500 leading-relaxed">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Header Remarks</span>
                {rfq.remarks}
              </div>
            )}
          </div>

          {/* Catalog items requested */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" /> Procurement Line Items ({rfq.line_items.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-3">SKU Catalog</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 text-center">Quantity</th>
                    <th className="px-3 py-3 text-center">UOM</th>
                    <th className="px-3 py-3 text-right">Est. Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {rfq.line_items.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/20">
                      <td className="px-3 py-3.5 font-bold text-blue-600">{line.item.sku}</td>
                      <td className="px-3 py-3.5 text-slate-800">{line.item.name}</td>
                      <td className="px-3 py-3.5 text-center font-bold text-slate-900">{line.quantity}</td>
                      <td className="px-3 py-3.5 text-center text-slate-400">{line.uom}</td>
                      <td className="px-3 py-3.5 text-right font-black text-slate-900">₹{line.estimated_budget.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Invitations, trace widget, comment portals */}
        <div className="space-y-6">
          {/* Dynamic Trace Widget */}
          <DocumentTraceabilityTimeline docType="RFQ" docId={id!} />

          {/* Supplier Invitations Portal */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                <Building className="w-4.5 h-4.5 text-slate-400" /> Invited Suppliers
              </h3>
              {rfq.status !== "APPROVED" && (
                <button
                  onClick={handleOpenInvite}
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-all"
                >
                  <Plus className="w-3 h-3" /> Invite
                </button>
              )}
            </div>

            <div className="space-y-3">
              {rfq.invitations.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No suppliers invited. Click 'Invite' to coordinate queries.</p>
              ) : (
                rfq.invitations.map((invite) => {
                  const hasResponded = rfq.quotations.some(q => q.vendor.name === invite.vendor.name);
                  return (
                    <div key={invite.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800 block">{invite.vendor.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Invited: {new Date(invite.invited_date).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasResponded ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-100 rounded">Responded</span>
                        ) : (
                          <>
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-100 rounded animate-pulse">Awaiting</span>
                            <button
                              onClick={() => handleOpenBid(invite.vendor.id)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline"
                            >
                              Log Quote
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quotations Submissions Registry */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-2">
              Bids Quotations Log ({rfq.quotations.length})
            </h3>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {rfq.quotations.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No quotation response sheets received.</p>
              ) : (
                rfq.quotations.map((quote) => (
                  <div key={quote.id} className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    quote.is_selected 
                      ? 'bg-emerald-50/30 border-emerald-200' 
                      : 'bg-slate-50 border-slate-150'
                  }`}>
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-slate-900 block">{quote.quotation_number} - {quote.vendor.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Lead: {quote.lead_time_days} days | Total: ₹{quote.total_quoted_price.toFixed(2)}</span>
                    </div>

                    {quote.is_selected && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[9px] uppercase tracking-widest rounded flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3 fill-emerald-100 text-emerald-800" /> Chosen
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- Invite Vendor Modal --- */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl max-w-md w-full space-y-4">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-extrabold text-slate-900">Invite Supplier</h3>
              <p className="text-xs text-slate-400 mt-0.5">Select a master vendor partner to dispatch pricing queries.</p>
            </div>

            {vendorsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">All master vendors are already invited.</p>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-bold uppercase">Select Supplier</label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 bg-slate-50"
                  >
                    {vendorsList.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.email || 'No email'})</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200/80 transition-all font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actioning}
                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1"
                  >
                    {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Dispatch invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- Submit Bid Modal --- */}
      {showBidModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-extrabold text-slate-900">Log Supplier Quotation Bid</h3>
              <p className="text-xs text-slate-400 mt-0.5">Submit pricing bid parameters details for the selected supplier.</p>
            </div>

            <form onSubmit={handleBidSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-bold uppercase">Quote Number Reference</label>
                  <input
                    type="text"
                    required
                    value={bidNumber}
                    onChange={(e) => setBidNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-bold uppercase">Lead Delivery Days</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={bidLeadTime}
                    onChange={(e) => setBidLeadTime(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
              </div>

              {/* Price rows spreadsheet grid */}
              <div className="space-y-2 border-t border-b border-slate-100 py-3">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Item Pricing Grid</span>
                <div className="space-y-2">
                  {rfq.line_items.map(line => (
                    <div key={line.id} className="flex items-center justify-between gap-4 p-2 bg-slate-50 rounded-lg border border-slate-150">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-slate-800">{line.item.sku}</span>
                        <span className="text-[10px] text-slate-400 block">Req: {line.quantity} {line.uom}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          required
                          placeholder="Unit price"
                          value={bidPrices[line.id] || ""}
                          onChange={(e) => setBidPrices(prev => ({ ...prev, [line.id]: e.target.value }))}
                          className="w-28 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-400 font-bold uppercase">Remarks</label>
                <input
                  type="text"
                  placeholder="Payment remarks or freight inclusions..."
                  value={bidRemarks}
                  onChange={(e) => setBidRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="px-4 py-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200/80 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actioning}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1"
                >
                  {actioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Quote"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RFQDetails;
