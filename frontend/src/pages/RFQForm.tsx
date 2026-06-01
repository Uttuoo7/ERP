import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Save, FileText, CheckCircle, Clock, Calendar, CheckSquare, Square, Layers, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRequisitions, createRFQFromPR } from "../api";

interface RequisitionLine {
  id: string;
  pr_number: string;
  item: {
    sku: string;
    name: string;
  };
  quantity: number;
  uom: string;
  estimated_price: number;
  required_date: string;
}

const RFQForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Available approved requisition lines for conversions
  const [availableLines, setAvailableLines] = useState<RequisitionLine[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);

  // Form states
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [remarks, setRemarks] = useState("");

  const fetchAvailablePRLines = async () => {
    setLoading(true);
    try {
      const res = await getRequisitions({ status_filter: "APPROVED" });
      
      // Flatten line items
      const lines: RequisitionLine[] = [];
      res.data.forEach((pr: any) => {
        pr.line_items.forEach((line: any) => {
          lines.push({
            id: line.id,
            pr_number: pr.pr_number,
            item: line.item,
            quantity: line.quantity,
            uom: line.uom,
            estimated_price: parseFloat(line.estimated_price),
            required_date: line.required_date
          });
        });
      });
      setAvailableLines(lines);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailablePRLines();
  }, []);

  const handleToggleSelectLine = (id: string) => {
    setSelectedLineIds(prev => 
      prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedLineIds.length === availableLines.length) {
      setSelectedLineIds([]);
    } else {
      setSelectedLineIds(availableLines.map(l => l.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLineIds.length === 0) {
      toast.error("Please select at least one approved requisition line to convert.");
      return;
    }
    if (!dueDate) {
      toast.error("RFQ response deadline due date is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        due_date: new Date(dueDate).toISOString(),
        currency,
        payment_terms: paymentTerms || null,
        delivery_terms: deliveryTerms || null,
        remarks: remarks || null,
        pr_line_ids: selectedLineIds
      };

      await createRFQFromPR(payload);
      toast.success("Request for Quotation (RFQ) generated successfully! Traceability linked.");
      navigate('/rfqs');
    } catch (err) {
      // Handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/rfqs')}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Generate RFQ from PR</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Convert approved purchase requisition items into competitive RFQ pricing invitations</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">Scanning approved purchase requisitions pool...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Selector list of approved lines */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" /> Approved Items Pool ({availableLines.length})
                  </h3>

                  {availableLines.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
                    >
                      {selectedLineIds.length === availableLines.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>

                {availableLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-xs font-medium text-slate-400 gap-2">
                    <FileText className="w-10 h-10 text-slate-300" />
                    <span>No approved requisition lines available for conversion.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {availableLines.map(line => {
                      const isSelected = selectedLineIds.includes(line.id);
                      return (
                        <div
                          key={line.id}
                          onClick={() => handleToggleSelectLine(line.id)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 text-xs font-medium ${
                            isSelected 
                              ? 'bg-blue-50/40 border-blue-200 shadow-sm shadow-blue-500/5' 
                              : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button type="button" className="text-blue-600">
                              {isSelected ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5 text-slate-350" />}
                            </button>
                            <div className="space-y-1">
                              <span className="font-extrabold text-blue-600 block">{line.pr_number}</span>
                              <span className="font-bold text-slate-800 text-sm block">{line.item.sku} - {line.item.name}</span>
                              <span className="text-slate-400 font-semibold">Qty: {line.quantity} {line.uom} | Est: ₹{line.estimated_price.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="text-right text-[10px] text-slate-400 font-bold uppercase">
                            Required: {new Date(line.required_date).toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: RFQ Header Details */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
                  <Layers className="w-4 h-4 text-blue-600" /> RFQ Parameters
                </h3>

                <div className="space-y-4 text-sm font-medium">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Due Deadline Date</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Terms</label>
                    <input
                      type="text"
                      placeholder="e.g. Net 30 days"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Terms</label>
                    <input
                      type="text"
                      placeholder="e.g. FOB Destination"
                      value={deliveryTerms}
                      onChange={(e) => setDeliveryTerms(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Remarks</label>
                    <textarea
                      placeholder="Special instructions for suppliers..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full min-h-[90px] p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all resize-none bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-50 pt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase">Selected Items</span>
                  <span className="px-2.5 py-0.5 rounded font-black text-xs bg-blue-50 text-blue-700 border border-blue-100">
                    {selectedLineIds.length} Lines selected
                  </span>
                </div>
              </div>

              {/* Form Action triggers */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/rfqs')}
                  className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl hover:bg-slate-200/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Generate RFQ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default RFQForm;
