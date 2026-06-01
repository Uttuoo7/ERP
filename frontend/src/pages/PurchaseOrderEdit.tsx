import { useEffect, useState } from 'react';
import { getPO, getVendors, updatePO, getItems, getAttachments, uploadAttachment, downloadAttachmentUrl } from "../api";
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from "../AuthContext";
import AddItemModal from '../components/AddItemModal';

export default function PurchaseOrderEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [po, setPo] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  const fetchDetails = () => {
    if (!id) return;
    getPO(id).then(res => setPo(res.data)).catch(console.error);
    getAttachments('PURCHASE_ORDER', id).then(res => setAttachments(res.data)).catch(console.error);
  };

  const fetchCatalog = () => {
    getItems().then(res => setCatalog(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchDetails();
    getVendors().then(res => setVendors(res.data)).catch(console.error);
    fetchCatalog();
  }, [id]);

  const canEdit = po?.status === 'DRAFT' && (role === 'ADMIN' || role === 'BUYER');

  const addLine = () => {
    setPo((prev: any) => ({
      ...prev,
      line_items: [...prev.line_items, { item_id: '', quantity_ordered: 1, unit_price: 0, description: '' }]
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !id) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_type', 'PURCHASE_ORDER');
    formData.append('po_id', id);

    uploadAttachment(formData).then(() => fetchDetails()).catch(console.error);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!canEdit) return;
    const { name, value } = e.target;
    setPo((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    if (!canEdit) return;
    const newItems = [...po.line_items];
    newItems[index][field] = value;
    setPo((prev: any) => ({ ...prev, line_items: newItems }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !canEdit) return;
    updatePO(id, po).then(() => {
      navigate('/pos');
    }).catch(console.error);
  };

  if (!po) return <div className="p-8">Loading PO data...</div>;

  const inputClass = canEdit 
    ? "w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm bg-white" 
    : "w-full border-gray-200 rounded-md shadow-sm p-2 border bg-gray-100 text-gray-600 cursor-not-allowed text-sm";

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
      <div className="flex-1">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Finalize Purchase Order ({po.po_number})</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-8">
        
        {!canEdit && (
          <div className="bg-red-50 p-4 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 font-medium">This Purchase Order is {po.status} and cannot be edited.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Vendor <span className="text-red-500">*</span></label>
          <select required name="vendor_id" disabled={!canEdit} value={po.vendor_id || ''} onChange={handleChange} className={inputClass}>
            <option value="">Select a vendor...</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 border-b pb-2">Shipping Logistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Type</label>
              <select name="delivery_type" disabled={!canEdit} value={po.delivery_type} onChange={handleChange} className={inputClass}>
                <option value="Warehouse">Warehouse</option>
                <option value="Customer Dropship">Customer Dropship</option>
              </select>
            </div>
            <div></div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Contact Name</label>
              <input type="text" name="ship_to_contact_name" readOnly={!canEdit} value={po.ship_to_contact_name} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Company Name</label>
              <input type="text" name="ship_to_company_name" readOnly={!canEdit} value={po.ship_to_company_name || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 1</label>
              <input type="text" name="ship_to_address_line1" readOnly={!canEdit} value={po.ship_to_address_line1} onChange={handleChange} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 2</label>
              <input type="text" name="ship_to_address_line2" readOnly={!canEdit} value={po.ship_to_address_line2} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
              <input type="text" name="ship_to_city" readOnly={!canEdit} value={po.ship_to_city} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
              <input type="text" name="ship_to_state" readOnly={!canEdit} value={po.ship_to_state} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PIN Code</label>
              <input type="text" name="ship_to_pin_code" readOnly={!canEdit} value={po.ship_to_pin_code} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input type="text" name="ship_to_phone" readOnly={!canEdit} value={po.ship_to_phone} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Line Items</h3>
          {po.line_items.map((item: any, idx: number) => {
            const catalogItem = catalog.find(c => c.id === item.item_id);
            return (
              <div key={idx} className="flex flex-col gap-3 mb-4 bg-gray-50 p-4 rounded-md shadow-sm border border-gray-200">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Item</label>
                    <select disabled={!canEdit} value={item.item_id} onChange={e => handleItemChange(idx, 'item_id', e.target.value)} className={inputClass}>
                      <option value="">Select Item...</option>
                      {catalog.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                    <input type="number" readOnly={!canEdit} value={item.quantity_ordered} onChange={e => handleItemChange(idx, 'quantity_ordered', parseInt(e.target.value))} className={inputClass} />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price (₹)</label>
                    <input type="number" step="0.01" readOnly={!canEdit} value={item.unit_price} onChange={e => handleItemChange(idx, 'unit_price', parseFloat(e.target.value))} className={inputClass} />
                  </div>
                  <div className="w-32 text-right py-2 text-sm font-bold text-gray-700">
                    ₹{(item.quantity_ordered * item.unit_price).toFixed(2)}
                  </div>
                </div>
                <div className="w-full mt-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Item Note</label>
                  <input type="text" readOnly={!canEdit} value={item.description || ''} onChange={e => handleItemChange(idx, 'description', e.target.value)} className={inputClass} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t pt-6 flex justify-between items-center">
          <div className="text-xl font-bold text-gray-900">
            Grand Total: <span className="text-green-600">₹{po.line_items.reduce((acc: number, cur: any) => acc + (cur.quantity_ordered * cur.unit_price), 0).toFixed(2)}</span>
          </div>
          {canEdit && (
            <div className="flex gap-6 mt-2">
              <button type="button" onClick={addLine} className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1">
                 <span>+ Add Line Item</span>
              </button>
              <button type="button" onClick={() => setIsAddItemModalOpen(true)} className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1">
                 <span>+ Create New Item</span>
              </button>
              <button type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded shadow hover:bg-blue-700 font-medium transition-colors">Confirm & Save PO</button>
            </div>
          )}
        </div>
        
        {po && (po.created_by || po.updated_by) && (
          <div className="border-t pt-4 mt-6 text-xs text-gray-500 flex justify-between">
            <div>
              {po.created_by && (
                <p>Created by: <span className="font-medium text-gray-700">{po.created_by.username}</span> on {new Date(po.order_date).toLocaleString()}</p>
              )}
            </div>
            <div className="text-right">
              {po.updated_by && po.updated_at && (
                <p>Last modified by: <span className="font-medium text-gray-700">{po.updated_by.username}</span> on {new Date(po.updated_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}
      </form>
      {isAddItemModalOpen && (
        <AddItemModal onClose={() => setIsAddItemModalOpen(false)} onSuccess={fetchCatalog} />
      )}
      </div>

      {/* Right Column: Attachments Widget */}
      <div className="w-full lg:w-96">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 sticky top-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            Attachments & Documents
          </h3>
          
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-500">PDF, PNG, JPG or DOCX</p>
              </div>
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <div className="space-y-3">
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center italic">No documents attached.</p>
            ) : (
              attachments.map(att => (
                <div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100 hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <svg className="w-6 h-6 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path></svg>
                    <div className="truncate">
                      <p className="text-sm font-medium text-gray-700 truncate" title={att.file_name}>{att.file_name}</p>
                      <p className="text-xs text-gray-400">{new Date(att.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <a href={downloadAttachmentUrl(att.id)} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-full transition-colors" title="Download">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
