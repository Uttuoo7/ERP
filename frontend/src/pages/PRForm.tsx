import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Save, Plus, Trash2, ArrowLeft, Loader2, Calendar, FileText, ShoppingCart, User, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  createRequisition, updateRequisition, getRequisition, 
  getItems, getVendors, getWarehouses, getMasterList 
} from "../api";

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

  // Master options lists
  const [items, setItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  // Form states
  const [departmentId, setDepartmentId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [requiredDate, setRequiredDate] = useState("");
  const [deliveryLocationId, setDeliveryLocationId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/requisitions')}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">
            {isEdit ? "Edit Requisition" : "Create Requisition"}
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Designate dynamic requisitions and attach budget tracking codes</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">Loading requisition details...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmitForm} className="space-y-8">
          {/* Section 1: Headers */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-3">
              <FileText className="w-4 h-4 text-blue-600" /> General Requisition Headers
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Project Reference</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Cost Center</label>
                <select
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                >
                  <option value="">-- Choose Cost Center --</option>
                  {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Priority Loop</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Target Delivery Date</label>
                <input
                  type="date"
                  required
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Warehouse</label>
                <select
                  value={deliveryLocationId}
                  onChange={(e) => setDeliveryLocationId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-semibold text-slate-700 bg-slate-50/50"
                >
                  <option value="">-- Choose Warehouse --</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Include key business contexts or delivery constraints..."
                className="w-full min-h-[70px] p-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all resize-none bg-slate-50/50"
              />
            </div>
          </div>

          {/* Section 2: Dynamic Line Grid */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" /> Dynamic Requisition Lines
              </h3>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-3 w-1/4">SKU / Item</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 w-20">Qty</th>
                    <th className="px-3 py-3 w-20">UOM</th>
                    <th className="px-3 py-3 w-28">Est. Price</th>
                    <th className="px-3 py-3 w-40">Suggested Vendor</th>
                    <th className="px-3 py-3 w-28">Budget Code</th>
                    <th className="px-3 py-3 w-12 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/30 text-xs">
                      <td className="px-2 py-3">
                        <select
                          required
                          value={line.item_id}
                          onChange={(e) => handleLineFieldChange(idx, 'item_id', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none font-medium"
                        >
                          <option value="">-- Choose Item SKU --</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineFieldChange(idx, 'description', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          required
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleLineFieldChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none font-semibold text-center"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={line.uom}
                          onChange={(e) => handleLineFieldChange(idx, 'uom', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none text-center"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          required
                          step="0.01"
                          value={line.estimated_price}
                          onChange={(e) => handleLineFieldChange(idx, 'estimated_price', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none font-semibold text-right"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <select
                          value={line.suggested_vendor_id}
                          onChange={(e) => handleLineFieldChange(idx, 'suggested_vendor_id', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                        >
                          <option value="">-- Sug. Vendor --</option>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="text"
                          placeholder="Code"
                          value={line.budget_code}
                          onChange={(e) => handleLineFieldChange(idx, 'budget_code', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                        />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Spend Projections Card */}
            <div className="flex items-center justify-end border-t border-slate-100 pt-4">
              <div className="bg-slate-50 px-6 py-4 rounded-xl border border-slate-100 text-right space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Estimated Gross Value</span>
                <span className="text-xl font-black text-slate-900">₹{grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/requisitions')}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl hover:bg-slate-200/80 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4.5 h-4.5" /> Save as Draft
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PRForm;
