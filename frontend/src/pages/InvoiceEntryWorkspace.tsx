import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ShieldCheck, Loader2, Landmark, Plus, Trash2, ArrowLeft, Layers, Calendar, Landmark as Bank, CheckCircle2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createInvoice, getPOs, getPO, getGRNs, getGRN } from "../api";

import { FormLayout, FormBody, FormSplitPane } from '../components/common/form/FormLayout';
import { FormStickyBar } from '../components/common/form/FormStickyBar';
import { DocumentContextHeader } from '../components/common/form/DocumentContextHeader';
import { FormSection } from '../components/common/form/FormSection';
import { StatusBadge } from '../components/common/StatusBadge';
import { WorkflowTimeline } from '../components/common/form/WorkflowTimeline';
import { AttachmentSection } from '../components/common/form/AttachmentSection';
import { RecentActivityFeed } from '../components/common/form/RecentActivityFeed';
import { ApprovalSummaryCard } from '../components/common/form/ApprovalSummaryCard';
import { ThreeWayMatchCard } from '../components/common/form/ThreeWayMatchCard';

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

  // Calculated Mocks for AP Readiness
  const invoiceTotal = lineItems.reduce((acc, curr) => acc + (parseFloat(curr.quantity_billed) * parseFloat(curr.unit_price)), 0) + (parseFloat(gstAmount) || 0) - (parseFloat(discountAmount) || 0);
  const poAmountMock = 125000;
  const grnAmountMock = grnId ? 120000 : 0;
  const varianceMock = invoiceTotal - (grnId ? grnAmountMock : poAmountMock);
  const hasVariance = varianceMock > 0;
  
  const paymentReady = !hasVariance && poId && grnId && lineItems.length > 0;

  const timelineStages: any[] = [
    { id: '1', label: 'Received', status: 'completed' },
    { id: '2', label: '3-Way Match', status: paymentReady ? 'completed' : 'current' },
    { id: '3', label: 'AP Review', status: 'pending' },
    { id: '4', label: 'Approved', status: 'pending' },
    { id: '5', label: 'Paid', status: 'pending' },
  ];

  const contextDetails = [
    { label: "Invoice Number", value: invoiceNumber || <span className="text-slate-400 italic">Draft (Unsaved)</span> },
    { label: "Vendor", value: poId ? posList.find(p => p.id === poId)?.vendor?.name : "Not Selected" },
    { label: "Linked PO", value: poId ? posList.find(p => p.id === poId)?.po_number : "None" },
    { label: "Linked GRN", value: grnId ? grnsList.find(g => g.id === grnId)?.grn_number : "None" },
    { label: "Invoice Date", value: new Date().toLocaleDateString() },
    { label: "Due Date", value: "Net 30 (Pending)" },
    { label: "Status", value: <StatusBadge status="neutral" label="DRAFT" /> },
  ];

  const matchDetails = {
    poMatch: !!poId,
    poVariance: !poId ? "Missing Reference" : undefined,
    grnMatch: !!grnId,
    grnVariance: !grnId ? "Awaiting Receipt" : undefined,
    invoiceMatch: !hasVariance,
    invoiceVariance: hasVariance ? `₹${varianceMock.toLocaleString()} Overbilled` : undefined
  };

  const mockApprovals = {
    currentApprover: 'AP Supervisor',
    approvalLevel: 'L1 AP Verification',
    escalationStatus: 'Normal' as const,
    slaDueDate: 'Tomorrow, 5:00 PM'
  };

  const leftPane = (
    <div className="space-y-6">
      <FormSection title="Invoice Processing Parameters" icon={<FileText className="w-4 h-4" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Purchase Order Ref <span className="text-red-500">*</span></label>
              <select required value={poId} onChange={(e) => setPoId(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all">
                <option value="">-- Select Active PO --</option>
                {posList.map(p => <option key={p.id} value={p.id}>{p.po_number} (Vendor: {p.vendor?.name})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Goods Receipt (GRN) Ref</label>
              <select value={grnId} disabled={!poId} onChange={(e) => setGrnId(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all">
                <option value="">-- No linked GRN (Full Accrual) --</option>
                {grnsList.filter(g => g.po_id === poId).map(g => <option key={g.id} value={g.id}>{g.grn_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">ERP Invoice Number <span className="text-red-500">*</span></label>
              <input type="text" required placeholder="e.g. ERP-INV-998" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Vendor Invoice Num</label>
              <input type="text" placeholder="e.g. TX-994322" value={vendorInvoiceNumber} onChange={(e) => setVendorInvoiceNumber(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Net GST (₹)</label>
              <input type="number" step="0.01" value={gstAmount} onChange={(e) => setGstAmount(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-bold text-slate-800 bg-white shadow-sm transition-all text-right" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">TDS Ded. (₹)</label>
              <input type="number" step="0.01" value={tdsDeducted} onChange={(e) => setTdsDeducted(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-bold text-slate-800 bg-white shadow-sm transition-all text-right" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Disc Amount (₹)</label>
              <input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-bold text-rose-600 bg-white shadow-sm transition-all text-right" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Remarks / Narration</label>
            <textarea rows={2} placeholder="Billing instructions..." value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all" />
          </div>
        </div>
      </FormSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttachmentSection attachments={[]} onUpload={() => {}} />
        <RecentActivityFeed activities={[]} />
      </div>
    </div>
  );

  const rightPane = (
    <>
      {/* Payment Readiness Indicator */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${paymentReady ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
        {paymentReady ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />}
        <div>
          <h4 className="text-sm font-black">{paymentReady ? 'Ready for Payment' : 'Blocked'}</h4>
          <p className="text-xs font-medium mt-0.5">{paymentReady ? '3-Way Match successful. Pending final approval.' : hasVariance ? 'Variance exceeds tolerance threshold.' : 'Missing GRN or Purchase Order reference.'}</p>
        </div>
      </div>

      <ThreeWayMatchCard details={matchDetails} />

      <FormSection title="Financial & Matching Summary">
        <div className="space-y-3.5">
          <div className="flex justify-between items-center pb-2.5">
            <span className="text-xs font-bold text-slate-500">Gross Invoice</span>
            <span className="text-sm font-semibold text-slate-900">₹{invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500">PO Value</span>
            <span className="text-sm font-semibold text-slate-600">₹{poAmountMock.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500">GRN Value</span>
            <span className="text-sm font-semibold text-slate-600">₹{grnAmountMock.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center pt-1 pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500">Variance</span>
            <span className={`text-sm font-black ${hasVariance ? 'text-rose-600' : 'text-emerald-600'}`}>
              {hasVariance ? `+₹${varianceMock.toLocaleString('en-IN')}` : '₹0.00'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Target Currency</span>
            <span className="text-xs font-black text-slate-900">INR</span>
          </div>
        </div>
      </FormSection>

      <FormSection title="Payment Terms">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Payment Terms</span>
            <span className="text-xs font-bold text-slate-900">Net 30</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Due Date</span>
            <span className="text-xs font-bold text-slate-900">2023-11-15</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Days Remaining</span>
            <span className="text-xs font-bold text-emerald-600">25 Days</span>
          </div>
        </div>
      </FormSection>

      <ApprovalSummaryCard details={mockApprovals} />
    </>
  );

  return (
    <FormLayout>
      <FormStickyBar 
        title="AP Invoice Processing"
        onBack={() => navigate('/invoices')}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="px-4 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-transparent hover:bg-slate-100 rounded-md transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-all shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bank className="w-4 h-4" />}
              {submitting ? "Registering..." : "Register Invoice"}
            </button>
          </>
        }
      />

      <div className="bg-white shadow-sm">
        <DocumentContextHeader details={contextDetails} />
        <WorkflowTimeline stages={timelineStages} />
      </div>

      <FormBody>
        <FormSplitPane left={leftPane} right={rightPane} />

        <FormSection title="Invoice Line Item Allocations" icon={<Layers className="w-4 h-4" />}>
          {!poId ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <span className="text-sm font-bold">Select a Purchase Order reference to load item lines worksheet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-erp-border bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-3 py-2 w-1/4">Item Description</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Recd (GRN)</th>
                    <th className="px-3 py-2 w-28 text-center">Billed Qty</th>
                    <th className="px-3 py-2 w-32 text-center">Unit Price (₹)</th>
                    <th className="px-3 py-2 w-28 text-center">Line Tax (₹)</th>
                    <th className="px-3 py-2 w-28 text-center">Line Disc (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/30 text-xs">
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-slate-900 block">{line.item_name}</span>
                        <span className="text-[10px] text-slate-500 font-semibold block">{line.item_sku}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-600">{line.quantity_ordered}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-600">{line.quantity_received}</td>
                      <td className="px-3 py-2.5">
                        <input type="number" required min="0" value={line.quantity_billed} onChange={(e) => handleLineChange(idx, "quantity_billed", e.target.value)} className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 font-bold text-slate-900" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="number" step="0.01" required value={line.unit_price} onChange={(e) => handleLineChange(idx, "unit_price", e.target.value)} className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 font-bold text-slate-900" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="number" step="0.01" value={line.tax_amount} onChange={(e) => handleLineChange(idx, "tax_amount", e.target.value)} className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 font-bold text-indigo-600" />
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="number" step="0.01" value={line.discount_amount} onChange={(e) => handleLineChange(idx, "discount_amount", e.target.value)} className="w-full px-2 py-1 text-center border border-slate-200 rounded outline-none focus:border-blue-500 font-bold text-rose-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormSection>
      </FormBody>
    </FormLayout>
  );
};

export default InvoiceEntryWorkspace;
