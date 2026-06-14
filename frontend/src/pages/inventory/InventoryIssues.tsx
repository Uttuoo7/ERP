import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash, CheckCircle2, Clock, XCircle, AlertTriangle,
  Building, Layers, FileText, Send, Check, ShieldAlert, BadgeInfo
} from 'lucide-react';
import toast from 'react-hot-toast';
import { get, post, getItems, getWarehouses } from '../../api';

// Enterprise form architecture imports
import { FormLayout, FormBody, FormSplitPane } from '../../components/common/form/FormLayout';
import { FormStickyBar } from '../../components/common/form/FormStickyBar';
import { FormSection } from '../../components/common/form/FormSection';
import { DocumentContextHeader } from '../../components/common/form/DocumentContextHeader';
import { WorkflowTimeline } from '../../components/common/form/WorkflowTimeline';
import { ApprovalSummaryCard } from '../../components/common/form/ApprovalSummaryCard';

interface IssueLine {
  id?: string;
  item_id: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  costing_method_used?: string;
  issue_cost_basis?: string;
  cost_layer_reference?: string;
}

interface Issue {
  id: string;
  issue_number: string;
  warehouse_id: string;
  department_id: string | null;
  issue_date: string;
  status: string; // DRAFT, SUBMITTED, APPROVED, POSTED
  issue_type: string; // ISSUE, RETURN, INTERNAL, SCRAP
  remarks: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  created_at: string;
  lines: IssueLine[];
}

const ISSUE_TYPES = [
  { value: "ISSUE", label: "Material Issue" },
  { value: "RETURN", label: "Material Return" },
  { value: "INTERNAL", label: "Internal Consumption" },
  { value: "SCRAP", label: "Scrap / Waste" }
];

export const InventoryIssues: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Master Data
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Form Fields (For New Issue)
  const [warehouseId, setWarehouseId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [issueType, setIssueType] = useState("ISSUE");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<IssueLine[]>([{ item_id: "", quantity: 0 }]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await get('/inventory/issues');
      // Wait, let's also fetch departments as part of this or separately
      setIssues(res.data || []);
    } catch (err: any) {
      console.error(err);
      // Fallback or custom fetch
      try {
        const res2 = await get('/inventory/issues/');
        setIssues(res2.data || []);
      } catch (e) {
        toast.error("Failed to load inventory issues registry.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const itemsRes = await getItems();
      setItems(itemsRes.data || []);

      const whRes = await getWarehouses();
      setWarehouses(whRes.data || []);

      const deptRes = await get('/masters/departments');
      setDepartments(deptRes.data || []);
    } catch (err) {
      console.error("Failed to load master records", err);
    }
  };

  useEffect(() => {
    fetchIssues();
    fetchMasterData();
  }, []);

  const handleAddLine = () => {
    setLineItems([...lineItems, { item_id: "", quantity: 0 }]);
  };

  const handleRemoveLine = (idx: number) => {
    const updated = [...lineItems];
    updated.splice(idx, 1);
    setLineItems(updated);
  };

  const handleLineChange = (idx: number, field: keyof IssueLine, value: any) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      toast.error("Warehouse is required.");
      return;
    }
    const validLines = lineItems.filter(l => l.item_id && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error("At least one valid line item is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        warehouse_id: warehouseId,
        department_id: departmentId || null,
        issue_date: new Date(issueDate).toISOString(),
        issue_type: issueType,
        remarks: remarks || null,
        line_items: validLines
      };

      const res = await post('/inventory/issues', payload);
      toast.success(`Draft created: ${res.data.issue_number}`);
      setIsCreating(false);
      resetForm();
      fetchIssues();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create issue.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await post(`/inventory/issues/${id}/submit`);
      toast.success("Document submitted for warehouse approval.");
      fetchIssues();
      if (selectedIssue?.id === id) {
        const updated = await get(`/inventory/issues/${id}`);
        setSelectedIssue(updated.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Submission failed.");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await post(`/inventory/issues/${id}/approve`);
      toast.success("Issue APPROVED and stock levels depleted!");
      fetchIssues();
      if (selectedIssue?.id === id) {
        const updated = await get(`/inventory/issues/${id}`);
        setSelectedIssue(updated.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Approval failed.");
    }
  };

  const handlePost = async (id: string) => {
    try {
      await post(`/inventory/issues/${id}/post`);
      toast.success("Issue POSTED to GL Ledger successfully!");
      fetchIssues();
      if (selectedIssue?.id === id) {
        const updated = await get(`/inventory/issues/${id}`);
        setSelectedIssue(updated.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Posting failed.");
    }
  };

  const resetForm = () => {
    setWarehouseId("");
    setDepartmentId("");
    setIssueType("ISSUE");
    setIssueDate(new Date().toISOString().split('T')[0]);
    setRemarks("");
    setLineItems([{ item_id: "", quantity: 0 }]);
  };

  // Helper labels
  const getItemDetails = (id: string) => {
    const it = items.find(i => i.id === id);
    return it ? `${it.sku} - ${it.name}` : "Unknown Item";
  };

  const getWarehouseName = (id: string) => {
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : "Unknown Warehouse";
  };

  const getDepartmentName = (id: string | null) => {
    if (!id) return "N/A";
    const dept = departments.find(d => d.id === id);
    return dept ? dept.name : "Unknown Department";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "POSTED":
        return <span className="px-2 py-0.5 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded uppercase">Posted</span>;
      case "APPROVED":
        return <span className="px-2 py-0.5 text-[10px] font-black text-blue-800 bg-blue-50 border border-blue-200 rounded uppercase">Approved</span>;
      case "SUBMITTED":
        return <span className="px-2 py-0.5 text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-200 rounded uppercase">Submitted</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-black text-slate-650 bg-slate-100 border border-slate-350 rounded uppercase">Draft</span>;
    }
  };

  // Timeline Setup
  const getTimelineStages = (status: string) => [
    { id: '1', label: 'Draft', status: 'completed' },
    { id: '2', label: 'Submitted', status: status === 'DRAFT' ? 'pending' : (status === 'SUBMITTED' ? 'current' : 'completed') },
    { id: '3', label: 'Approved (WH)', status: ['DRAFT', 'SUBMITTED'].includes(status) ? 'pending' : (status === 'APPROVED' ? 'current' : 'completed') },
    { id: '4', label: 'Posted (GL)', status: status === 'POSTED' ? 'completed' : 'pending' }
  ];

  if (isCreating) {
    const leftPane = (
      <FormSection title="Consumption Details" icon={<Layers className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-450 uppercase">Warehouse Zone *</label>
            <select
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-semibold"
            >
              <option value="">-- Choose Warehouse --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-450 uppercase">Cost Center / Dept</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-semibold"
            >
              <option value="">-- Choose Department --</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-450 uppercase">Issue Date *</label>
            <input
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-450 uppercase">Consumption Type *</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-bold text-slate-700"
            >
              {ISSUE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-450 uppercase">Remarks / Narrative</label>
            <textarea
              placeholder="E.g., Production raw components release, scrap logging..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-xs font-medium min-h-[40px] resize-none"
            />
          </div>
        </div>

        {/* Lines form section */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Line Item Consumption</h4>
            <button
              type="button"
              onClick={handleAddLine}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[10px] font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Material Line
            </button>
          </div>

          <div className="space-y-3.5">
            {lineItems.map((line, idx) => (
              <div key={idx} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100 relative">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Product SKU Catalog *</label>
                  <select
                    required
                    value={line.item_id}
                    onChange={(e) => handleLineChange(idx, 'item_id', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white focus:border-blue-500 text-xs font-semibold text-slate-700"
                  >
                    <option value="">-- Choose Item SKU --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>
                    ))}
                  </select>
                </div>

                <div className="w-48 space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Quantity (Decimal) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    min="0.0001"
                    placeholder="e.g., 24.50"
                    value={line.quantity || ""}
                    onChange={(e) => handleLineChange(idx, 'quantity', e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white focus:border-blue-500 text-xs font-semibold text-slate-800"
                  />
                </div>

                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-100 transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </FormSection>
    );

    const rightPane = (
      <FormSection title="Audit Framework" icon={<BadgeInfo className="w-4.5 h-4.5" />}>
        <div className="space-y-4 text-xs font-semibold text-slate-500 leading-relaxed">
          <p className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>This transaction will run in DRAFT mode. Stock valuation layers will not change until Warehouse Approval occurs.</span>
          </p>
          <p className="flex items-start gap-2">
            <BadgeInfo className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>Fractional quantities are fully supported for chemicals, liquids, weights, and measures.</span>
          </p>
        </div>
      </FormSection>
    );

    return (
      <FormLayout>
        <FormStickyBar
          title="Create Material Consumption Issue"
          onBack={() => setIsCreating(false)}
          actions={
            <>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-slate-250 hover:bg-slate-300 text-slate-650 rounded-xl font-bold transition-all text-xs border border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 text-xs"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Save Draft
              </button>
            </>
          }
        />
        <FormBody>
          <FormSplitPane left={leftPane} right={rightPane} />
        </FormBody>
      </FormLayout>
    );
  }

  if (selectedIssue) {
    const docContext = [
      { label: "Document ID", value: selectedIssue.issue_number },
      { label: "Status", value: getStatusBadge(selectedIssue.status) },
      { label: "Type", value: <span className="font-bold text-slate-800">{selectedIssue.issue_type}</span> },
      { label: "Warehouse", value: getWarehouseName(selectedIssue.warehouse_id) },
      { label: "Department", value: getDepartmentName(selectedIssue.department_id) },
      { label: "Issue Date", value: new Date(selectedIssue.issue_date).toLocaleDateString() }
    ];

    const leftPane = (
      <FormSection title="Document Lines" icon={<Layers className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                <th className="p-4">SKU / Component</th>
                <th className="p-4 text-right">Quantity</th>
                <th className="p-4 text-right">Unit Cost (₹)</th>
                <th className="p-4 text-right">Total Cost (₹)</th>
                {["APPROVED", "POSTED"].includes(selectedIssue.status) && (
                  <>
                    <th className="p-4">Cost Basis</th>
                    <th className="p-4">Layers Depleted</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedIssue.lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-bold text-slate-850">{getItemDetails(line.item_id)}</td>
                  <td className="p-4 text-right font-extrabold text-slate-800">{Number(line.quantity).toFixed(4)}</td>
                  <td className="p-4 text-right font-bold text-slate-600">₹{Number(line.unit_cost || 0).toFixed(2)}</td>
                  <td className="p-4 text-right font-extrabold text-slate-900">₹{Number(line.total_cost || 0).toFixed(2)}</td>
                  {["APPROVED", "POSTED"].includes(selectedIssue.status) && (
                    <>
                      <td className="p-4">
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-100 rounded">
                          {line.issue_cost_basis || line.costing_method_used || "N/A"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] text-slate-450 font-bold font-mono truncate max-w-[200px] block" title={line.cost_layer_reference}>
                          {line.cost_layer_reference || "N/A"}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSection>
    );

    const rightPane = (
      <div className="space-y-6">
        <ApprovalSummaryCard
          details={{
            currentApprover: selectedIssue.status === 'DRAFT' ? 'Warehouse Operator' : (selectedIssue.status === 'SUBMITTED' ? 'Warehouse Manager' : 'Finance Manager'),
            approvalLevel: selectedIssue.status === 'POSTED' ? 'GL Posting Completed' : (selectedIssue.status === 'APPROVED' ? 'Valued & Approved' : 'Review & Verification'),
            slaDueDate: 'Within 24 Hours',
            escalationStatus: 'Normal'
          }}
        />

        <FormSection title="Remarks" icon={<FileText className="w-4 h-4" />}>
          <p className="text-xs font-semibold text-slate-650 leading-relaxed italic">
            {selectedIssue.remarks || "No administrative remarks associated with this document."}
          </p>
        </FormSection>
      </div>
    );

    return (
      <FormLayout>
        <FormStickyBar
          title={`Material Issue: ${selectedIssue.issue_number}`}
          onBack={() => setSelectedIssue(null)}
          actions={
            <>
              {selectedIssue.status === "DRAFT" && (
                <button
                  onClick={() => handleSubmit(selectedIssue.id)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Submit Document
                </button>
              )}
              {selectedIssue.status === "SUBMITTED" && (
                <button
                  onClick={() => handleApprove(selectedIssue.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Approve Consumption
                </button>
              )}
              {selectedIssue.status === "APPROVED" && (
                <button
                  onClick={() => handlePost(selectedIssue.id)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Post GL Entries
                </button>
              )}
              <button
                onClick={() => setSelectedIssue(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold text-xs transition-colors border border-slate-250"
              >
                Back to List
              </button>
            </>
          }
        />
        <FormBody>
          <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm mb-6">
            <DocumentContextHeader details={docContext} />
            <div className="mt-8 border-t border-slate-100 pt-6">
              <WorkflowTimeline stages={getTimelineStages(selectedIssue.status)} />
            </div>
          </div>
          <FormSplitPane left={leftPane} right={rightPane} />
        </FormBody>
      </FormLayout>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen text-xs font-semibold text-slate-650">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Material Consumption Engine</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Audit trail, cost layer trace, FIFO/WAC depletion, and General Ledger accounting integration</p>
        </div>

        <button
          onClick={() => { resetForm(); setIsCreating(true); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Consumption Issue
        </button>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-semibold">Loading consumption registry...</span>
          </div>
        ) : issues.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2 text-center">
            <Layers className="w-10 h-10 text-slate-350 mb-1" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Registry Empty</span>
            <span className="text-[10px] text-slate-350 mt-1">No material issues or returns have been registered yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 uppercase font-black tracking-wider text-[10px]">
                  <th className="p-4">Document ID</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Warehouse</th>
                  <th className="p-4">Cost Center Dept</th>
                  <th className="p-4">Issue Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Lines Count</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedIssue(issue)}
                        className="font-extrabold text-blue-650 hover:underline"
                      >
                        {issue.issue_number}
                      </button>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-slate-100 border border-slate-200 rounded">
                        {issue.issue_type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-650 font-bold">{getWarehouseName(issue.warehouse_id)}</td>
                    <td className="p-4 text-slate-650 font-bold">{getDepartmentName(issue.department_id)}</td>
                    <td className="p-4">{new Date(issue.issue_date).toLocaleDateString()}</td>
                    <td className="p-4">{getStatusBadge(issue.status)}</td>
                    <td className="p-4 text-right font-bold text-slate-800">{issue.lines?.length || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedIssue(issue)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded border border-slate-200 text-[10px] font-bold"
                        >
                          View Details
                        </button>
                        {issue.status === "DRAFT" && (
                          <button
                            onClick={() => handleSubmit(issue.id)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 text-[10px] font-bold"
                          >
                            Submit
                          </button>
                        )}
                        {issue.status === "SUBMITTED" && (
                          <button
                            onClick={() => handleApprove(issue.id)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 text-[10px] font-bold"
                          >
                            Approve
                          </button>
                        )}
                        {issue.status === "APPROVED" && (
                          <button
                            onClick={() => handlePost(issue.id)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 text-[10px] font-bold"
                          >
                            Post GL
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
