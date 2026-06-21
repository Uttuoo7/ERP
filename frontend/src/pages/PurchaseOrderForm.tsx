import { useEffect, useState } from 'react';
import { getVendors, getItems, getWarehouses, createPO } from "../api";
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, Truck, ShoppingCart, User, Layers, FileText } from 'lucide-react';
import AddItemModal from '../components/AddItemModal';
import { useWorkspaceTabState } from '../hooks/useWorkspaceTabState';

import { FormLayout, FormBody, FormSplitPane } from '../components/common/form/FormLayout';
import { FormStickyBar } from '../components/common/form/FormStickyBar';
import { DocumentContextHeader } from '../components/common/form/DocumentContextHeader';
import { FormSection } from '../components/common/form/FormSection';
import { StatusBadge } from '../components/common/StatusBadge';
import { WorkflowTimeline } from '../components/common/form/WorkflowTimeline';
import { AttachmentSection } from '../components/common/form/AttachmentSection';
import { RecentActivityFeed } from '../components/common/form/RecentActivityFeed';
import { ApprovalSummaryCard } from '../components/common/form/ApprovalSummaryCard';

export default function PurchaseOrderForm() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [vendorId, setVendorId] = useWorkspaceTabState('vendorId', '');
  const [deliveryType, setDeliveryType] = useWorkspaceTabState('deliveryType', 'Warehouse');
  const [warehouseId, setWarehouseId] = useWorkspaceTabState('warehouseId', '');
  
  const [shipping, setShipping] = useWorkspaceTabState('shipping', {
    contactName: '',
    companyName: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pinCode: '',
    phone: ''
  });

  const [lineItems, setLineItems] = useWorkspaceTabState('lineItems', [{ item_id: '', quantity_ordered: 1, unit_price: 0, description: '' }]);
  const navigate = useNavigate();

  const fetchCatalog = () => {
    getItems().then(res => setCatalog(res.data)).catch(console.error);
  };

  useEffect(() => {
    getVendors().then(res => setVendors(res.data)).catch(console.error);
    fetchCatalog();
    getWarehouses().then(res => setWarehouses(res.data)).catch(console.error);
  }, []);

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wId = e.target.value;
    setWarehouseId(wId);
    const selectedWarehouse = warehouses.find(w => w.id === wId);
    if (selectedWarehouse) {
      setShipping({
        contactName: selectedWarehouse.contact_name || '',
        companyName: selectedWarehouse.company_name || '',
        addressLine1: selectedWarehouse.address_line1 || '',
        addressLine2: selectedWarehouse.address_line2 || '',
        landmark: selectedWarehouse.landmark || '',
        city: selectedWarehouse.city || '',
        state: selectedWarehouse.state || '',
        pinCode: selectedWarehouse.pin_code || '',
        phone: selectedWarehouse.phone || ''
      });
    } else {
      setShipping({
        contactName: '', companyName: '', addressLine1: '', addressLine2: '',
        landmark: '', city: '', state: '', pinCode: '', phone: ''
      });
    }
  };

  const handleDeliveryTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    setDeliveryType(type);
    setWarehouseId('');
    setShipping({
      contactName: '', companyName: '', addressLine1: '', addressLine2: '',
      landmark: '', city: '', state: '', pinCode: '', phone: ''
    });
  };

  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShipping(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...lineItems];
    // @ts-ignore
    newItems[index][field] = value;
    if (field === 'item_id') {
      const selected = catalog.find(i => i.id === value);
      if (selected) newItems[index].unit_price = selected.unit_price;
    }
    setLineItems(newItems);
  };

  const addLine = () => setLineItems([...lineItems, { item_id: '', quantity_ordered: 1, unit_price: 0, description: '' }]);

  const removeLine = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));

  const total = lineItems.reduce((acc, item) => acc + (item.quantity_ordered * item.unit_price), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipping.contactName || !shipping.addressLine1 || !shipping.city || !shipping.state || !shipping.pinCode || !shipping.phone) {
      alert("Please fill all required shipping fields.");
      return;
    }
    createPO({ 
      vendor_id: vendorId, 
      line_items: lineItems,
      delivery_type: deliveryType,
      warehouse_id: warehouseId || undefined,
      ship_to_contact_name: shipping.contactName,
      ship_to_company_name: shipping.companyName || undefined,
      ship_to_address_line1: shipping.addressLine1,
      ship_to_address_line2: shipping.addressLine2,
      ship_to_landmark: shipping.landmark || undefined,
      ship_to_city: shipping.city,
      ship_to_state: shipping.state,
      ship_to_pin_code: shipping.pinCode,
      ship_to_phone: shipping.phone
    }).then(() => navigate('/pos')).catch(console.error);
  };

  const readOnly = deliveryType === 'Warehouse';
  const inputClass = "w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 font-medium text-slate-800 bg-white shadow-sm transition-all";
  const readOnlyInputClass = "w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none bg-slate-100 text-slate-500 font-medium shadow-sm transition-all";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  // Mocks for UX Standardization
  const taxRate = 0.05;
  const subtotal = total;
  const tax = subtotal * taxRate;
  const grandTotal = subtotal + tax;

  const timelineStages: any[] = [
    { id: '1', label: 'Draft', status: 'current' },
    { id: '2', label: 'Submitted', status: 'pending' },
    { id: '3', label: 'Manager Auth', status: 'pending' },
    { id: '4', label: 'Finance Auth', status: 'pending' },
    { id: '5', label: 'PO Issued', status: 'pending' },
  ];

  const contextDetails = [
    { label: "PO Number", value: <span className="text-slate-400 italic">Draft (Unsaved)</span> },
    { label: "Vendor", value: vendorId ? vendors.find(v => v.id === vendorId)?.name : 'Not Selected' },
    { label: "Status", value: <StatusBadge status="neutral" label="DRAFT" /> },
    { label: "Buyer", value: "Current User" },
    { label: "Created Date", value: new Date().toLocaleDateString() },
    { label: "Currency", value: "INR" },
    { label: "Version", value: "v1.0" },
  ];

  const mockApprovals = {
    currentApprover: 'Pending Submission',
    approvalLevel: 'L1 Manager Review',
    escalationStatus: 'Normal' as const
  };

  const leftPane = (
    <div className="space-y-6">
      <FormSection title="Vendor Information" icon={<User className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className={labelClass}>Supplier <span className="text-red-500">*</span></label>
            <select required value={vendorId} onChange={e => setVendorId(e.target.value)} className={inputClass}>
              <option value="">Select a vendor...</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Delivery Information" icon={<Truck className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 border-b border-slate-100 pb-5">
          <div>
            <label className={labelClass}>Delivery Type <span className="text-red-500">*</span></label>
            <select value={deliveryType} onChange={handleDeliveryTypeChange} className={inputClass}>
              <option value="Warehouse">Internal Warehouse</option>
              <option value="Customer Dropship">Customer Dropship</option>
            </select>
          </div>

          {deliveryType === 'Warehouse' && (
            <div>
              <label className={labelClass}>Internal Location <span className="text-red-500">*</span></label>
              <select required value={warehouseId} onChange={handleWarehouseChange} className={inputClass}>
                <option value="">Select internal warehouse...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
          <div className="lg:col-span-3">
            <label className={labelClass}>Contact Name <span className="text-red-500">*</span></label>
            <input required type="text" name="contactName" value={shipping.contactName} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
          </div>
          <div className="lg:col-span-3">
            <label className={labelClass}>Company Name</label>
            <input type="text" name="companyName" value={shipping.companyName} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
          </div>
          <div className="lg:col-span-3">
            <label className={labelClass}>Address Line 1 <span className="text-red-500">*</span></label>
            <input required type="text" name="addressLine1" value={shipping.addressLine1} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
          </div>
          <div className="lg:col-span-3">
            <label className={labelClass}>Address Line 2 <span className="text-red-500">*</span></label>
            <input required type="text" name="addressLine2" value={shipping.addressLine2} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
          </div>
          <div>
            <label className={labelClass}>City <span className="text-red-500">*</span></label>
            <input required type="text" name="city" value={shipping.city} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
          </div>
          <div>
            <label className={labelClass}>State <span className="text-red-500">*</span></label>
            <input required type="text" name="state" value={shipping.state} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
          </div>
          <div>
            <label className={labelClass}>PIN Code <span className="text-red-500">*</span></label>
            <input required type="text" name="pinCode" value={shipping.pinCode} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
          </div>
          <div className="lg:col-span-3">
            <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
            <input required type="text" name="phone" value={shipping.phone} onChange={handleShippingChange} readOnly={readOnly} className={readOnly ? readOnlyInputClass : inputClass} />
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
      <FormSection title="Financial Totals">
        <div className="space-y-3.5">
          <div className="flex justify-between items-center pb-2.5">
            <span className="text-xs font-bold text-slate-500">Subtotal</span>
            <span className="text-sm font-semibold text-slate-900">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500">Estimated Tax (5%)</span>
            <span className="text-sm font-semibold text-slate-900">₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center pt-1 pb-2.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500">Grand Total</span>
            <span className="text-xl font-black text-slate-900">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Target Currency</span>
            <span className="text-xs font-black text-slate-900">INR</span>
          </div>
        </div>
      </FormSection>

      <FormSection title="Procurement Terms">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Vendor Rating</span>
            <span className="text-xs font-bold text-emerald-600">A+ (Preferred)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Payment Terms</span>
            <span className="text-xs font-bold text-slate-900">Net 30</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-500">Incoterms</span>
            <span className="text-xs font-bold text-slate-900">DDP</span>
          </div>
        </div>
      </FormSection>

      <ApprovalSummaryCard details={mockApprovals} />
    </>
  );

  return (
    <FormLayout>
      <FormStickyBar 
        title="Draft Purchase Order"
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
              className="flex items-center gap-1.5 px-5 py-1.5 text-sm font-bold text-white bg-erp-primary hover:bg-blue-800 rounded-md transition-all shadow-sm"
            >
              <Save className="w-4 h-4" /> Save as Draft
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

        <FormSection title="Purchase Order Lines" icon={<Layers className="w-4 h-4" />}>
          <div className="flex justify-end mb-3 gap-3">
            <button
              type="button"
              onClick={() => setIsAddItemModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-all"
            >
              + Create SKU
            </button>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-all"
            >
              + Add Line
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-erp-border bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-2 py-2 w-1/4">SKU / Item <span className="text-red-500">*</span></th>
                  <th className="px-2 py-2">Item Note / Description</th>
                  <th className="px-2 py-2 w-24">Qty <span className="text-red-500">*</span></th>
                  <th className="px-2 py-2 w-32">Unit Price (₹) <span className="text-red-500">*</span></th>
                  <th className="px-2 py-2 w-32 text-right">Total (₹)</th>
                  <th className="px-2 py-2 w-12 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 text-xs">
                    <td className="px-1 py-1.5">
                      <select required value={item.item_id} onChange={e => handleItemChange(idx, 'item_id', e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none font-medium text-slate-700">
                        <option value="">Select an item...</option>
                        {catalog.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="text" value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} placeholder="Optional instructions..." className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" min="1" required value={item.quantity_ordered} onChange={e => handleItemChange(idx, 'quantity_ordered', parseInt(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none font-bold text-center" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" step="0.01" required value={item.unit_price} onChange={e => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded outline-none font-bold text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-slate-900">
                      ₹{(item.quantity_ordered * item.unit_price).toFixed(2)}
                    </td>
                    <td className="px-1 py-1.5 text-right">
                      <button type="button" onClick={() => removeLine(idx)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormSection>

      </FormBody>

      {isAddItemModalOpen && (
        <AddItemModal onClose={() => setIsAddItemModalOpen(false)} onSuccess={fetchCatalog} />
      )}
    </FormLayout>
  );
}
