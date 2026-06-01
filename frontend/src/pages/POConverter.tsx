import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Save, FileText, CheckCircle, Clock, Calendar, Sparkles, Building, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRFQs, convertRFQToPO } from "../api";

interface RFQLine {
  id: string;
  item: {
    sku: string;
    name: string;
  };
  quantity: number;
  uom: string;
}

interface RFQ {
  id: string;
  rfq_number: string;
  due_date: string;
  status: string;
  quotations: any[];
  line_items: RFQLine[];
}

const POConverter: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  
  // Converter inputs
  const [wonQuotation, setWonQuotation] = useState<any | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({}); // rfq_line_id -> qty_to_order

  const fetchApprovedRFQs = async () => {
    setLoading(true);
    try {
      const res = await getRFQs({ status_filter: "APPROVED" });
      setRfqs(res.data);
      if (res.data.length > 0) {
        handleSelectRFQ(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedRFQs();
  }, []);

  const handleSelectRFQ = (rfq: RFQ) => {
    setSelectedRFQ(rfq);
    
    // Find the selected/won quotation
    const won = rfq.quotations.find((q: any) => q.is_selected);
    setWonQuotation(won || null);

    // Initialize quantities to order with RFQ quantities
    const qtys: Record<string, number> = {};
    rfq.line_items.forEach(line => {
      qtys[line.id] = line.quantity;
    });
    setQuantities(qtys);
  };

  const handleQtyChange = (lineId: string, value: number, maxVal: number) => {
    const qty = Math.max(1, Math.min(maxVal, value));
    setQuantities(prev => ({ ...prev, [lineId]: qty }));
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRFQ || !wonQuotation) {
      toast.error("Please select an RFQ with an approved winner to convert.");
      return;
    }

    setConverting(true);
    try {
      const lines = Object.entries(quantities).map(([lineId, qty]) => ({
        rfq_line_id: lineId,
        quantity_ordered: qty
      }));

      const payload = {
        rfq_id: selectedRFQ.id,
        vendor_id: wonQuotation.vendor_id,
        lines: lines
      };

      const res = await convertRFQToPO(payload);
      toast.success("Purchase Order issued and logged in traceability engine!");
      navigate(`/pos/${res.data.id}`);
    } catch (err) {
      // Handled
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/pos')}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">RFQ to PO Converter</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Transform approved vendor selection parameters directly into binding Purchase Orders</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">Scanning awarded RFQ registries...</p>
        </div>
      ) : rfqs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-350 mx-auto" />
          <div>
            <p className="text-sm font-bold text-slate-900">No awarded RFQs ready for conversion.</p>
            <p className="text-xs text-slate-400 mt-1">Please approve a supplier quote option inside the RFQ Matrix first.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Select RFQ & Items */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
                <Sparkles className="w-4 h-4 text-blue-600" /> Awarded RFQs Ready ({rfqs.length})
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rfqs.map(rfq => (
                  <div
                    key={rfq.id}
                    onClick={() => handleSelectRFQ(rfq)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 text-xs font-semibold ${
                      selectedRFQ?.id === rfq.id 
                        ? 'border-blue-500 bg-blue-50/20 shadow-sm' 
                        : 'border-slate-150 bg-slate-50/50 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-extrabold text-blue-600 text-sm block">{rfq.rfq_number}</span>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>{rfq.line_items.length} Line items</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold border border-emerald-150 rounded">Winner Selected</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedRFQ && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
                  Items to convert
                </h3>
                
                <div className="space-y-3">
                  {selectedRFQ.line_items.map(line => (
                    <div key={line.id} className="p-4 rounded-xl border border-slate-150 bg-slate-50/40 flex items-center justify-between gap-4 text-xs font-semibold">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 text-sm block">{line.item.sku} - {line.item.name}</span>
                        <span className="text-slate-400">Original RFQ Target: {line.quantity} {line.uom}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">Order Qty:</span>
                        <input
                          type="number"
                          required
                          min={1}
                          max={line.quantity}
                          value={quantities[line.id] || ""}
                          onChange={(e) => handleQtyChange(line.id, Number(e.target.value), line.quantity)}
                          className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center font-bold text-slate-850 bg-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Selected Winner Info & Convert Action */}
          <div className="space-y-6">
            {wonQuotation && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-3 flex items-center gap-2">
                  <Building className="w-4.5 h-4.5 text-blue-600" /> Awardee Supplier
                </h3>
                
                <div className="space-y-4 text-xs font-semibold text-slate-500">
                  <div className="flex items-center justify-between border-b border-slate-50 py-1">
                    <span className="text-slate-400">Selected Vendor</span>
                    <span className="text-slate-900 font-extrabold text-sm">{wonQuotation.vendor?.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between border-b border-slate-50 py-1">
                    <span className="text-slate-400">Winning Quote Ref</span>
                    <span className="text-slate-900 font-bold">{wonQuotation.quotation_number}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-50 py-1">
                    <span className="text-slate-400">Total Quoted Value</span>
                    <span className="text-slate-900 font-black text-sm">₹{parseFloat(wonQuotation.total_quoted_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-50 py-1">
                    <span className="text-slate-400">Commitment Lead Time</span>
                    <span className="text-slate-900 font-bold">{wonQuotation.lead_time_days} days</span>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs font-semibold text-blue-800 leading-relaxed space-y-1">
                  <span className="font-extrabold block">Fulfillment Readiness</span>
                  <span>Converting this quotation creates a binding Purchase Order with 18% tax auto-inclusions. All item values are registered automatically.</span>
                </div>

                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="w-full py-3 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-1.5"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" /> Issuing Order...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4.5 h-4.5" /> Convert & Issue PO
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default POConverter;
