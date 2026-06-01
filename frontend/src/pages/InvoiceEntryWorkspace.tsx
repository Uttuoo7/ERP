import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ShieldCheck, Loader2, Landmark, Plus, Trash2, ArrowLeft, Layers, Calendar, Landmark as Bank
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createInvoice, getPOs, getPO, getGRNs, getGRN } from "../api";

const InvoiceEntryWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Lists
  const [posList, setPosList] = useState<any[]>([]);
  const [grnsList, setGrnsList] = useState<any[]>([]);

  // Form Headers
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [poId, setPoId] = useState("");
  const [grnId, setGrnId] = useState("");
  const [gstAmount, setGstAmount] = useState("0");
  const [tdsDeducted, setTdsDeducted] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [remarks, setRemarks] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<any[]>([]);

  const fetchRefs = async () => {
    try {
      const posRes = await getPOs();
      setPosList(posRes.data.filter((p: any) => p.status === 'ISSUED' || p.status === 'PARTIAL_RECEIPT'));

      const grnsRes = await getGRNs();
      setGrnsList(grnsRes.data);
    } catch (err) {
      toast.error("Failed to load reference POs and GRNs.");
    }
  };

  useEffect(() => {
    fetchRefs();
  }, []);

  // When PO changes, load PO line items to populate line grid
  useEffect(() => {
    if (poId) {
      getPO(poId).then(res => {
        const poData = res.data;
        const initialLines = poData.line_items.map((line: any) => ({
          po_line_item_id: line.id,
          grn_line_item_id: "",
          item_sku: line.item.sku,
          item_name: line.item.name,
          quantity_ordered: line.quantity_ordered,
          quantity_received: line.quantity_received,
          quantity_billed: line.quantity_ordered - line.quantity_billed, // default to remaining
          unit_price: parseFloat(line.unit_price),
          tax_amount: 0,
          discount_amount: 0
        }));
        setLineItems(initialLines);
      }).catch(() => toast.error("Failed to fetch detailed PO line items."));
    } else {
      setLineItems([]);
    }
  }, [poId]);

  // When GRN changes, map matching GRN line items if exists
  useEffect(() => {
    if (grnId && lineItems.length > 0) {
      getGRN(grnId).then(res => {
        const grnData = res.data;
        // Map grn line items to po line items
        const updated = lineItems.map(line => {
          const match = grnData.line_items.find((g: any) => g.po_line_item_id === line.po_line_item_id);
          return {
            ...line,
            grn_line_item_id: match ? match.id : "",
            quantity_received: match ? match.quantity_accepted : line.quantity_received
          };
        });
        setLineItems(updated);
      }).catch(() => toast.error("Failed to match GRN lines."));
    }
  }, [grnId]);

  const handleLineChange = (idx: number, key: string, val: any) => {
    setLineItems(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        [key]: val
      };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || !invoiceNumber.trim()) {
      toast.error("Please specify a purchase order and invoice number.");
      return;
    }

    const billedItems = lineItems.map(item => ({
      po_line_item_id: item.po_line_item_id,
      grn_line_item_id: item.grn_line_item_id || null,
      quantity_billed: parseInt(item.quantity_billed) || 0,
      unit_price: parseFloat(item.unit_price) || 0.00,
      tax_amount: parseFloat(item.tax_amount) || 0.00,
      discount_amount: parseFloat(item.discount_amount) || 0.00
    })).filter(x => x.quantity_billed > 0);

    if (billedItems.length === 0) {
      toast.error("Please bill at least one line item.");
      return;
    }

    setSubmitting(true);
    try {
      await createInvoice({
        po_id: poId,
        grn_id: grnId || null,
        invoice_number: invoiceNumber.trim(),
        vendor_invoice_number: vendorInvoiceNumber.trim() || null,
        gst_amount: parseFloat(gstAmount) || 0.00,
        tds_deducted: parseFloat(tdsDeducted) || 0.00,
        discount_amount: parseFloat(discountAmount) || 0.00,
        remarks: remarks.trim() || null,
        billed_items: billedItems
      });

      toast.success("Invoice registered successfully!");
      navigate("/invoices");
    } catch (err) {
      // Handled globally
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/invoices")}
            className="p-2 hover:bg-slate-150 rounded-xl text-slate-500 hover:text-slate-700 transition-all border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-none">Accounts Payable Entry Workspace</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Capture invoice details, allocate to active PO/GRN lines, and configure taxes</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-xs font-semibold text-slate-500">
        {/* Left Column: Form Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
              <Layers className="w-4.5 h-4.5 text-blue-600" /> Invoice Line Item Allocations
            </h3>

            {!poId ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 text-slate-350 mx-auto mb-2" />
                <span>Select a Purchase Order reference to load item lines worksheet.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      <th className="px-3 py-2.5">Item Description</th>
                      <th className="px-3 py-2.5 text-center">Ordered</th>
                      <th className="px-3 py-2.5 text-center">Recd (GRN)</th>
                      <th className="px-3 py-2.5 text-center w-24">Billed Qty</th>
                      <th className="px-3 py-2.5 text-center w-28">Unit Price (₹)</th>
                      <th className="px-3 py-2.5 text-center w-24">Line Tax (₹)</th>
                      <th className="px-3 py-2.5 text-center w-24">Line Disc (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-semibold text-slate-700 bg-white">
                    {lineItems.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-3 py-3">
                          <span className="font-extrabold text-slate-900 block">{line.item_name}</span>
                          <span className="text-[9px] text-slate-400 font-semibold block">{line.item_sku}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500">{line.quantity_ordered}</td>
                        <td className="px-3 py-3 text-center text-slate-500">{line.quantity_received}</td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            required
                            min="0"
                            value={line.quantity_billed}
                            onChange={(e) => handleLineChange(idx, "quantity_billed", e.target.value)}
                            className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 text-slate-800"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(idx, "unit_price", e.target.value)}
                            className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 text-slate-800"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={line.tax_amount}
                            onChange={(e) => handleLineChange(idx, "tax_amount", e.target.value)}
                            className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 text-slate-800 text-indigo-650"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={line.discount_amount}
                            onChange={(e) => handleLineChange(idx, "discount_amount", e.target.value)}
                            className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 text-slate-800 text-rose-600"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AP Form settings and totals */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-2.5">
              Invoice Summary Parameters
            </h3>

            <div className="space-y-4">
              {/* Reference PO Picker */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Purchase Order Reference *</label>
                <select
                  required
                  value={poId}
                  onChange={(e) => setPoId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800 font-bold"
                >
                  <option value="">-- Select Active PO --</option>
                  {posList.map(p => (
                    <option key={p.id} value={p.id}>{p.po_number} (Vendor: {p.vendor?.name})</option>
                  ))}
                </select>
              </div>

              {/* Reference GRN Picker */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Goods Receipt (GRN) Reference (Optional)</label>
                <select
                  value={grnId}
                  disabled={!poId}
                  onChange={(e) => setGrnId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800"
                >
                  <option value="">-- No linked GRN (Full Accrual) --</option>
                  {grnsList.filter(g => g.po_id === poId).map(g => (
                    <option key={g.id} value={g.id}>{g.grn_number} (Challan: {g.delivery_challan_number || 'N/A'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Invoice number */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">ERP Invoice Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ERP-INV-998"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800"
                  />
                </div>

                {/* Vendor Invoice number */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vendor Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. TX-994322"
                    value={vendorInvoiceNumber}
                    onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* GST input */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Net GST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800 text-right"
                  />
                </div>

                {/* TDS input */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">TDS Ded. (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tdsDeducted}
                    onChange={(e) => setTdsDeducted(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800 text-right"
                  />
                </div>

                {/* General Discount */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Disc Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800 text-right"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Remarks / Narration</label>
                <textarea
                  rows={2}
                  placeholder="Additional matching or billing instructions..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-800 text-xs font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-5 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-1.5 text-sm font-bold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" /> Registering invoice...
                    </>
                  ) : (
                    "Register & Run 3-Way Match"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InvoiceEntryWorkspace;
