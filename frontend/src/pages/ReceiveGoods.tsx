import { useEffect, useState } from 'react';
import { getPOs, getPO, createGRN } from "../api";
import { useNavigate } from 'react-router-dom';
import { Save, PackageCheck, AlertCircle, Warehouse, ClipboardCheck, ArrowRightLeft } from 'lucide-react';

import { FormLayout, FormBody, FormSplitPane } from '../components/common/form/FormLayout';
import { FormStickyBar } from '../components/common/form/FormStickyBar';
import { DocumentContextHeader } from '../components/common/form/DocumentContextHeader';
import { FormSection } from '../components/common/form/FormSection';
import { StatusBadge } from '../components/common/StatusBadge';
import { WorkflowTimeline } from '../components/common/form/WorkflowTimeline';
import { AttachmentSection } from '../components/common/form/AttachmentSection';
import { RecentActivityFeed } from '../components/common/form/RecentActivityFeed';
import { ApprovalSummaryCard } from '../components/common/form/ApprovalSummaryCard';

export default function ReceiveGoods() {
  const [pos, setPOs] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [poDetails, setPODetails] = useState<any>(null);
  const [receiveLines, setReceiveLines] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getPOs().then(res => {
      const issued = res.data.filter((po: any) => po.status === 'ISSUED' || po.status === 'PARTIAL_RECEIPT');
      setPOs(issued);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedPOId) {
      getPO(selectedPOId).then(res => {
        setPODetails(res.data);
        const lines = res.data.line_items.map((li: any) => ({
          item_id: li.item_id,
          po_line_item_id: li.id,
          quantity_ordered: li.quantity_ordered,
          quantity_received: li.quantity_received,
          quantity_accepted: 0,
          quantity_rejected: 0
        }));
        setReceiveLines(lines);
      }).catch(console.error);
    } else {
      setPODetails(null);
      setReceiveLines([]);
    }
  }, [selectedPOId]);

  const handleLineChange = (index: number, field: string, value: number) => {
    const newLines = [...receiveLines];
    newLines[index][field] = value;
    setReceiveLines(newLines);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      po_id: selectedPOId,
      received_items: receiveLines.filter(line => line.quantity_accepted > 0 || line.quantity_rejected > 0).map(line => ({
        item_id: line.item_id,
        quantity_accepted: line.quantity_accepted,
        quantity_rejected: line.quantity_rejected
      }))
    };
    
    if (payload.received_items.length === 0) {
      alert("Please enter a received quantity greater than 0 for at least one item.");
      return;
    }

    createGRN(payload).then(() => {
      navigate('/pos');
    }).catch(console.error);
  };

  const expectedQty = receiveLines.reduce((sum, line) => sum + (line.quantity_ordered - line.quantity_received), 0);
  const acceptedQty = receiveLines.reduce((sum, line) => sum + line.quantity_accepted, 0);
  const damagedQty = receiveLines.reduce((sum, line) => sum + line.quantity_rejected, 0);
  const variance = expectedQty - acceptedQty;

  const skusAffected = receiveLines.filter(l => l.quantity_accepted > 0).length;
  // Mock value received calculation (assuming unit_price is 100 for mock)
  const valueReceived = acceptedQty * 100;

  const timelineStages: any[] = [
    { id: '1', label: 'Expected', status: 'completed' },
    { id: '2', label: 'Unloading', status: 'current' },
    { id: '3', label: 'Inspection', status: 'pending' },
    { id: '4', label: 'Putaway', status: 'pending' },
    { id: '5', label: 'Receipted', status: 'pending' },
  ];

  const contextDetails = [
    { label: "GRN Number", value: <span className="text-slate-400 italic">Draft (Unsaved)</span> },
    { label: "Linked PO", value: poDetails?.po_number || "Not Selected" },
    { label: "Vendor", value: poDetails?.vendor_id || "Not Selected" },
    { label: "Warehouse", value: poDetails?.warehouse_id || "Main Distribution Center" },
    { label: "Receiver", value: "Current User" },
    { label: "Receipt Date", value: new Date().toLocaleDateString() },
  ];

  const mockApprovals = {
    currentApprover: 'Warehouse Supervisor',
    approvalLevel: 'L1 Dock Receipt',
    escalationStatus: 'Normal' as const
  };

  const leftPane = (
    <div className="space-y-6">
      <FormSection title="Purchase Order Selection" icon={<ClipboardCheck className="w-4 h-4" />}>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Pending Order <span className="text-red-500">*</span></label>
          <select value={selectedPOId} onChange={e => setSelectedPOId(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all">
            <option value="">Select an ISSUED PO...</option>
            {pos.map(po => <option key={po.id} value={po.id}>{po.po_number} (Status: {po.status})</option>)}
          </select>
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
      <FormSection title="Receiving Metrics">
        <div className="space-y-3.5">
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500">Expected Quantity</span>
            <span className="text-sm font-semibold text-slate-900">{expectedQty}</span>
          </div>
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-emerald-600">Accepted Quantity</span>
            <span className="text-sm font-black text-emerald-600">{acceptedQty}</span>
          </div>
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-rose-500">Damaged Quantity</span>
            <span className="text-sm font-bold text-rose-500">{damagedQty}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Variance (Short)</span>
            <span className={`text-sm font-black ${variance > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{variance}</span>
          </div>
        </div>
      </FormSection>

      <FormSection title="Inventory Impact">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">SKUs Affected</span>
            <span className="text-xs font-bold text-blue-600">{skusAffected} items</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Value Received</span>
            <span className="text-xs font-bold text-slate-900">~₹{valueReceived.toLocaleString()}</span>
          </div>
        </div>
      </FormSection>

      <FormSection title="Warehouse Routing">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Location</span>
            <span className="text-xs font-bold text-slate-900">Main DC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Staging Bin</span>
            <span className="text-xs font-bold text-blue-600">RCV-A01</span>
          </div>
        </div>
      </FormSection>

      <ApprovalSummaryCard details={mockApprovals} />
    </>
  );

  return (
    <FormLayout>
      <FormStickyBar 
        title="Inbound Goods Receipt"
        onBack={() => navigate('/pos')}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/pos')}
              className="px-4 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-transparent hover:bg-slate-100 rounded-md transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-all shadow-sm"
            >
              <PackageCheck className="w-4 h-4" /> Submit GRN
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

        {poDetails && (
          <FormSection title="Receipt Validation Grid" icon={<ArrowRightLeft className="w-4 h-4" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-erp-border bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-3 py-2 w-1/3">Item Details</th>
                    <th className="px-3 py-2 w-24 text-right">Ordered</th>
                    <th className="px-3 py-2 w-24 text-right">Prior Rcvd</th>
                    <th className="px-3 py-2 w-24 text-right">Pending</th>
                    <th className="px-3 py-2 w-32">Accept (Good)</th>
                    <th className="px-3 py-2 w-32">Reject (Damaged)</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiveLines.map((line, idx) => {
                    const pending = line.quantity_ordered - line.quantity_received;
                    const varianceLine = pending - line.quantity_accepted - line.quantity_rejected;
                    const isShort = varianceLine > 0;
                    const isOver = varianceLine < 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/30 text-xs">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-800">SKU: {line.item_id.substring(0, 8)}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-600">{line.quantity_ordered}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-600">{line.quantity_received}</td>
                        <td className="px-3 py-2 text-right font-black text-slate-900">{pending}</td>
                        <td className="px-3 py-2">
                          <input 
                            type="number" 
                            min="0" 
                            max={pending} 
                            value={line.quantity_accepted} 
                            onChange={e => handleLineChange(idx, 'quantity_accepted', parseInt(e.target.value) || 0)} 
                            className="w-full px-2 py-1 border border-slate-200 rounded outline-none font-bold text-center focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="number" 
                            min="0" 
                            value={line.quantity_rejected} 
                            onChange={e => handleLineChange(idx, 'quantity_rejected', parseInt(e.target.value) || 0)} 
                            className="w-full px-2 py-1 border border-slate-200 rounded outline-none font-bold text-center focus:border-rose-500 focus:ring-1 focus:ring-rose-500" 
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isShort && <StatusBadge status="warning" label={`Short: ${varianceLine}`} />}
                          {isOver && <StatusBadge status="error" label={`Over: ${Math.abs(varianceLine)}`} />}
                          {!isShort && !isOver && <StatusBadge status="success" label="Match" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </FormSection>
        )}
      </FormBody>
    </FormLayout>
  );
}
