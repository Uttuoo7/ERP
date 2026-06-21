import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkspaceTabState } from '../hooks/useWorkspaceTabState';
import { 
  Save, Plus, Trash2, ArrowLeft, Loader2, Calendar, FileText, ShoppingCart, User, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  createRequisition, updateRequisition, getRequisition, 
  getItems, getVendors, getWarehouses, getMasterList 
} from "../api";
import { FormLayout, FormBody, FormSplitPane } from '../components/common/form/FormLayout';
import { FormStickyBar } from '../components/common/form/FormStickyBar';
import { DocumentContextHeader } from '../components/common/form/DocumentContextHeader';
import { FormSection } from '../components/common/form/FormSection';
import { StatusBadge } from '../components/common/StatusBadge';
import { WorkflowTimeline } from '../components/common/form/WorkflowTimeline';
import { AttachmentSection } from '../components/common/form/AttachmentSection';
import { RecentActivityFeed } from '../components/common/form/RecentActivityFeed';
import { ApprovalSummaryCard } from '../components/common/form/ApprovalSummaryCard';

interface LineItem {
  item_id: string;
  description: string;
  quantity: number;
  uom: string;
  estimated_price: number;
  suggested_vendor_id: string;
  required_date: string;
  remarks: string;
  budget_code: string;
  tax_category: string;
}

const PRForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prRecord, setPrRecord] = useState<any>(null);

  // Master options lists
  const [items, setItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  // Form states using workspace tab storage
  const [departmentId, setDepartmentId] = useWorkspaceTabState("pr_departmentId", "");
  const [projectId, setProjectId] = useWorkspaceTabState("pr_projectId", "");
  const [costCenterId, setCostCenterId] = useWorkspaceTabState("pr_costCenterId", "");
  const [priority, setPriority] = useWorkspaceTabState("pr_priority", "MEDIUM");
  const [requiredDate, setRequiredDate] = useWorkspaceTabState("pr_requiredDate", "");
  const [deliveryLocationId, setDeliveryLocationId] = useWorkspaceTabState("pr_deliveryLocationId", "");
  const [currency, setCurrency] = useWorkspaceTabState("pr_currency", "INR");
  const [remarks, setRemarks] = useWorkspaceTabState("pr_remarks", "");
  const [lineItems, setLineItems] = useWorkspaceTabState<LineItem[]>("pr_lineItems", [
    {
      item_id: "",
      description: "",
      quantity: 1,
      uom: "Units",
      estimated_price: 0,
      suggested_vendor_id: "",
      required_date: "",
      remarks: "",
      budget_code: "",
      tax_category: ""
    }
  ]);

  // Load dropdown lists on mount
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [itemsRes, vendorsRes, whRes, deptRes, projRes, ccRes] = await Promise.all([
          getItems(),
          getVendors(),
          getWarehouses(),
          getMasterList("departments", { limit: 100 }),
          getMasterList("projects", { limit: 100 }),
          getMasterList("cost-centers", { limit: 100 })
        ]);
        setItems(itemsRes.data);
        setVendors(vendorsRes.data);
        setWarehouses(whRes.data);
        setDepartments(deptRes.data.items || []);
        setProjects(projRes.data.items || []);
        setCostCenters(ccRes.data.items || []);
      } catch (err) {
        console.error("Error loading master options lists:", err);
      }
    };
    loadMasterData();
  }, []);

  // Load existing details if editing
  useEffect(() => {
    if (isEdit) {
      const loadDetails = async () => {
        setLoading(true);
        try {
          const res = await getRequisition(id!);
          const pr = res.data;
          setPrRecord(pr);
          
          setDepartmentId(pr.department_id || "");
          setProjectId(pr.project_id || "");
          setCostCenterId(pr.cost_center_id || "");
          setPriority(pr.priority);
          setRequiredDate(pr.required_date ? pr.required_date.substring(0, 10) : "");
          setDeliveryLocationId(pr.delivery_location_id || "");
          setCurrency(pr.currency);
          setRemarks(pr.remarks || "");
          
          const mappedLines = pr.line_items.map((line: any) => ({
            item_id: line.item_id,
            description: line.description || "",
            quantity: line.quantity,
            uom: line.uom,
            estimated_price: parseFloat(line.estimated_price),
            suggested_vendor_id: line.suggested_vendor_id || "",
            required_date: line.required_date ? line.required_date.substring(0, 10) : "",
            remarks: line.remarks || "",
            budget_code: line.budget_code || "",
            tax_category: line.tax_category || ""
          }));
          setLineItems(mappedLines);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      loadDetails();
    }
  }, [isEdit, id]);

  const handleAddLine = () => {
    setLineItems(prev => [
      ...prev,
      {
        item_id: "",
        description: "",
        quantity: 1,
        uom: "Units",
        estimated_price: 0,
        suggested_vendor_id: "",
        required_date: "",
        remarks: "",
        budget_code: "",
        tax_category: ""
      }
    ]);
  };

  const handleDeleteLine = (index: number) => {
    if (lineItems.length === 1) {
      toast.error("A requisition requires at least one line item.");
      return;
    }
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleLineFieldChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    
    // Auto-populate item fields if item selection changed
    if (field === "item_id") {
      const selectedItem = items.find(it => it.id === value);
      if (selectedItem) {
        updated[index] = {
          ...updated[index],
          item_id: value,
          description: selectedItem.description || selectedItem.name,
          uom: selectedItem.uom || "Units",
          estimated_price: parseFloat(selectedItem.unit_price) || 0
        };
        setLineItems(updated);
        return;
      }
    }

    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setLineItems(updated);
  };

  const grossTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.estimated_price), 0);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (lineItems.some(line => !line.item_id)) {
      toast.error("Please select a valid item catalog SKU for all lines.");
      return;
    }
    if (lineItems.some(line => line.quantity <= 0)) {
      toast.error("Quantity must be greater than zero for all lines.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        department_id: departmentId || null,
        project_id: projectId || null,
        cost_center_id: costCenterId || null,
        priority,
        required_date: requiredDate ? new Date(requiredDate).toISOString() : new Date().toISOString(),
        delivery_location_id: deliveryLocationId || null,
        currency,
        remarks: remarks || null,
        line_items: lineItems.map(line => ({
          ...line,
          suggested_vendor_id: line.suggested_vendor_id || null,
          required_date: line.required_date ? new Date(line.required_date).toISOString() : null,
          remarks: line.remarks || null,
          budget_code: line.budget_code || null,
          tax_category: line.tax_category || null
        }))
      };

      if (isEdit) {
        await updateRequisition(id!, payload);
        toast.success("Purchase Requisition updated as DRAFT!");
      } else {
        await createRequisition(payload);
        toast.success("Purchase Requisition created as DRAFT!");
      }
      navigate('/requisitions');
    } catch (err) {
      // Handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  const contextDetails = isEdit && prRecord ? [
    { label: "Document ID", value: prRecord.pr_number },
    { label: "Status", value: <StatusBadge status={prRecord.status === 'APPROVED' ? 'success' : prRecord.status === 'DRAFT' ? 'neutral' : 'warning'} label={prRecord.status} /> },
    { label: "Requester", value: `${prRecord.requester?.first_name || 'Current User'} ${prRecord.requester?.last_name || ''}` },
    { label: "Department", value: prRecord.department?.name || 'N/A' },
    { label: "Priority", value: prRecord.priority },
    { label: "Target Date", value: new Date(prRecord.required_date).toLocaleDateString() },
  ] : [
    { label: "Document ID", value: <span className="text-slate-400 italic">Draft (Unsaved)</span> },
    { label: "Status", value: <StatusBadge status="neutral" label="NEW" /> },
    { label: "Requester", value: "Current User" },
    { label: "Priority", value: priority },
    { label: "Target Date", value: requiredDate ? new Date(requiredDate).toLocaleDateString() : 'Not Set' }
  ];

  // UX Enhancement Mocks
  const timelineStages: any[] = [
    { id: '1', label: 'Draft', status: prRecord ? 'completed' : 'current' },
    { id: '2', label: 'Submitted', status: prRecord?.status === 'APPROVED' ? 'completed' : prRecord?.status === 'PENDING' ? 'current' : 'pending' },
    { id: '3', label: 'Under Review', status: prRecord?.status === 'APPROVED' ? 'completed' : prRecord?.status === 'PENDING' ? 'current' : 'pending' },
    { id: '4', label: 'Approved', status: prRecord?.status === 'APPROVED' ? 'current' : 'pending' },
    { id: '5', label: 'Closed', status: 'pending' },
  ];

  const mockAttachments = isEdit ? [
    { id: 'a1', name: 'Vendor_Quote_Q3.pdf', size: '2.4 MB', uploadedBy: 'Jane Doe', uploadedAt: '10 mins ago' },
    { id: 'a2', name: 'Budget_Approval_Email.msg', size: '150 KB', uploadedBy: 'System Admin', uploadedAt: '1 hr ago' }
  ] : [];

  const mockActivities = isEdit ? [
    { id: '1', timestamp: 'Today, 10:42 AM', user: 'System', action: 'SLA Warning Triggered', details: 'Approaching 24h SLA deadline for Level 1.' },
    { id: '2', timestamp: 'Yesterday, 4:15 PM', user: 'Jane Doe', action: 'Purchase Requisition Submitted' },
    { id: '3', timestamp: 'Yesterday, 3:00 PM', user: 'Jane Doe', action: 'Created Draft PR' },
  ] : [];

  const mockApprovals = {
    currentApprover: 'Director of Procurement',
    nextApprover: 'VP of Finance (Pending Level 1)',
    approvalLevel: 'L1 Manager Review',
    slaDueDate: 'Tomorrow, 5:00 PM',
    escalationStatus: 'Warning' as const
  };

  const leftPane = (
    <div className="space-y-6">
      <FormSection title="Commercial Terms" icon={<FileText className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div>
            <label className={labelClass}>Department</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputClass}>
              <option value="">-- Choose --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Project Reference</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
              <option value="">-- Choose --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Cost Center</label>
            <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className={inputClass}>
              <option value="">-- Choose --</option>
              {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Delivery Information" icon={<ShoppingCart className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Delivery Warehouse</label>
            <select value={deliveryLocationId} onChange={(e) => setDeliveryLocationId(e.target.value)} className={inputClass}>
              <option value="">-- Choose Warehouse --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Target Delivery Date</label>
            <input type="date" required value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Priority Loop</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Overall Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Delivery constraints..."
              className={`${inputClass} min-h-[40px] resize-none`}
              rows={1}
            />
          </div>
        </div>
      </FormSection>

      {/* UX Enhancements: Attachments & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttachmentSection attachments={mockAttachments} onUpload={() => {}} onDelete={() => {}} />
        <RecentActivityFeed activities={mockActivities} />
      </div>
    </div>
  );

  const rightPane = (
    <>
    <FormSection title="Requisition Summary">
      <div className="space-y-3.5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <span className="text-sm font-bold text-slate-500">Total Lines</span>
          <span className="text-sm font-black text-slate-900">{lineItems.length}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <span className="text-sm font-bold text-slate-500">Gross Value</span>
          <span className="text-xl font-black text-slate-900">₹{grossTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-500">Target Currency</span>
          <span className="text-sm font-black text-slate-900">{currency}</span>
        </div>
      </div>
    </FormSection>

    {isEdit && (
      <ApprovalSummaryCard details={mockApprovals} />
    )}
  </>
  );

  return (
    <FormLayout>
      <FormStickyBar 
        title={isEdit ? `Requisition: ${prRecord?.pr_number || 'Loading...'}` : "New Purchase Requisition"}
        onBack={() => navigate('/requisitions')}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/requisitions')}
              className="px-4 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-transparent hover:bg-slate-100 rounded-md transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitForm}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-5 py-1.5 text-sm font-bold text-white bg-erp-primary hover:bg-blue-800 rounded-md transition-all shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? "Update Changes" : "Save as Draft"}
            </button>
          </>
        }
      />
      
      {!loading && (
        <div className="bg-white shadow-sm">
          <DocumentContextHeader details={contextDetails} />
          <WorkflowTimeline stages={timelineStages} />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-bold">Loading Requisition details...</p>
        </div>
      ) : (
        <FormBody>
          <FormSplitPane left={leftPane} right={rightPane} />

          <FormSection title="Dynamic Requisition Lines" icon={<Layers className="w-4 h-4" />}>
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-erp-border bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-2 py-2 w-1/4">SKU / Item</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2 w-20">Qty</th>
                    <th className="px-2 py-2 w-20">UOM</th>
                    <th className="px-2 py-2 w-28">Est. Price</th>
                    <th className="px-2 py-2 w-40">Sug. Vendor</th>
                    <th className="px-2 py-2 w-28">Budget Code</th>
                    <th className="px-2 py-2 w-10 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/30 text-xs">
                      <td className="px-1 py-1.5">
                        <select required value={line.item_id} onChange={(e) => handleLineFieldChange(idx, 'item_id', e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none font-medium text-slate-700">
                          <option value="">-- SKU --</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <input type="text" value={line.description} onChange={(e) => handleLineFieldChange(idx, 'description', e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none" />
                      </td>
                      <td className="px-1 py-1.5">
                        <input type="number" required min="1" value={line.quantity} onChange={(e) => handleLineFieldChange(idx, 'quantity', parseInt(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none font-bold text-center" />
                      </td>
                      <td className="px-1 py-1.5">
                        <input type="text" value={line.uom} onChange={(e) => handleLineFieldChange(idx, 'uom', e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none text-center" />
                      </td>
                      <td className="px-1 py-1.5">
                        <input type="number" required step="0.01" value={line.estimated_price} onChange={(e) => handleLineFieldChange(idx, 'estimated_price', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none font-bold text-right" />
                      </td>
                      <td className="px-1 py-1.5">
                        <select value={line.suggested_vendor_id} onChange={(e) => handleLineFieldChange(idx, 'suggested_vendor_id', e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none">
                          <option value="">-- Vendor --</option>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <input type="text" placeholder="Code" value={line.budget_code} onChange={(e) => handleLineFieldChange(idx, 'budget_code', e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none" />
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <button type="button" onClick={() => handleDeleteLine(idx)} className="p-1 text-slate-400 hover:text-rose-600 rounded transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>
        </FormBody>
      )}
    </FormLayout>
  );
};

export default PRForm;
