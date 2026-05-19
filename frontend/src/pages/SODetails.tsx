import { useEffect, useState } from 'react';
import { getSO, getAttachments, uploadAttachment, downloadAttachmentUrl, updateSO } from '../api';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function SODetails() {
  const { id } = useParams();
  const { role } = useAuth();
  const [so, setSo] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);

  const fetchDetails = () => {
    if (!id) return;
    getSO(id).then(res => setSo(res.data)).catch(console.error);
    getAttachments('SALES_ORDER', id).then(res => setAttachments(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const canEdit = so && (
    (so.status === 'DRAFT') ||
    (so.status === 'APPROVED' && (role === 'ADMIN' || role === 'BUYER'))
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!canEdit) return;
    const { name, value } = e.target;
    setSo((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    if (!canEdit) return;
    const newItems = [...so.line_items];
    newItems[index][field] = value;
    setSo((prev: any) => ({ ...prev, line_items: newItems }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !canEdit) return;
    updateSO(id, so).then(() => {
      alert("Changes saved successfully!");
      fetchDetails();
    }).catch(console.error);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !id) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_type', 'SALES_ORDER');
    formData.append('so_id', id);
    uploadAttachment(formData).then(() => fetchDetails()).catch(console.error);
  };

  if (!so) return <div className="p-8">Loading...</div>;

  const inputClass = canEdit 
    ? "w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm bg-white" 
    : "w-full border-gray-200 rounded-md shadow-sm p-2 border bg-gray-100 text-gray-600 cursor-not-allowed text-sm";

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
      
      <div className="flex-1 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Requisition: {so.so_number}</h1>
            <div className="flex gap-4 items-center">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${so.status === 'DRAFT' ? 'bg-gray-200 text-gray-700' : so.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {so.status}
              </span>
              {canEdit && (
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium text-sm transition-colors">
                  Save Changes
                </button>
              )}
            </div>
          </div>

          {!canEdit && (
            <div className="bg-gray-50 p-4 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-600 font-medium">This document is locked for your role or status ({so.status}). Fields are read-only.</p>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Shipping Logistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Type</label>
                <select name="delivery_type" disabled={!canEdit} value={so.delivery_type} onChange={handleChange} className={inputClass}>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Customer Dropship">Customer Dropship</option>
                </select>
              </div>
              <div></div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contact Name</label>
                <input type="text" name="ship_to_contact_name" readOnly={!canEdit} value={so.ship_to_contact_name} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Company Name</label>
                <input type="text" name="ship_to_company_name" readOnly={!canEdit} value={so.ship_to_company_name || ''} onChange={handleChange} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 1</label>
                <input type="text" name="ship_to_address_line1" readOnly={!canEdit} value={so.ship_to_address_line1} onChange={handleChange} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 2</label>
                <input type="text" name="ship_to_address_line2" readOnly={!canEdit} value={so.ship_to_address_line2} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                <input type="text" name="ship_to_city" readOnly={!canEdit} value={so.ship_to_city} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                <input type="text" name="ship_to_state" readOnly={!canEdit} value={so.ship_to_state} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">PIN Code</label>
                <input type="text" name="ship_to_pin_code" readOnly={!canEdit} value={so.ship_to_pin_code} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input type="text" name="ship_to_phone" readOnly={!canEdit} value={so.ship_to_phone} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Requested Items</h3>
            <div className="space-y-4">
              {so.line_items.map((item: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-3 pb-4 border-b last:border-0 last:pb-0">
                  <div className="flex justify-between items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Item ID</label>
                      <input type="text" readOnly value={item.item_id} className="w-full border-gray-200 rounded-md shadow-sm p-2 border bg-gray-100 text-gray-600 text-sm" />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                      <input type="number" readOnly={!canEdit} value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value))} className={inputClass} />
                    </div>
                  </div>
                  <div className="w-full mt-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                    <input type="text" readOnly={!canEdit} value={item.notes || ''} onChange={e => handleItemChange(idx, 'notes', e.target.value)} className={inputClass} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
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
