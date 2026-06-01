import { useState, useEffect } from 'react';
import { updateVendor } from "../api";

export default function EditVendorModal({ vendor, onClose, onSuccess }: { vendor: any, onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: vendor.name,
    contact_email: vendor.contact_email,
    contact_phone: vendor.contact_phone || '',
    default_lead_time_days: vendor.default_lead_time_days || 0,
    gstin: vendor.gstin || '',
    pan: vendor.pan || '',
    is_msme: vendor.is_msme || false,
    ifsc_code: vendor.ifsc_code || '',
    is_active: vendor.is_active
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // @ts-ignore
    const checked = type === 'checkbox' ? e.target.checked : undefined;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateVendor(vendor.id, formData)
      .then(() => {
        onSuccess();
        onClose();
      })
      .catch(console.error);
  };

  const inputClass = "w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm bg-white";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Edit Vendor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Email</label>
              <input required type="email" name="contact_email" value={formData.contact_email} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Phone</label>
              <input type="text" name="contact_phone" value={formData.contact_phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lead Time (Days)</label>
              <input type="number" name="default_lead_time_days" value={formData.default_lead_time_days} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">GSTIN</label>
              <input type="text" name="gstin" value={formData.gstin} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">PAN</label>
              <input type="text" name="pan" value={formData.pan} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">IFSC Code</label>
              <input type="text" name="ifsc_code" value={formData.ifsc_code} onChange={handleChange} className={inputClass} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" name="is_msme" checked={formData.is_msme} onChange={handleChange} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
              <label className="text-sm font-medium text-gray-700">Is MSME Registered?</label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
              <label className="text-sm font-medium text-gray-700">Active Status</label>
            </div>
          </div>
          <div className="pt-6 border-t flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
