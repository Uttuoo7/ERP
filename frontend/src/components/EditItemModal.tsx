import { useState } from 'react';
import { updateItem } from '../api';

export default function EditItemModal({ item, onClose, onSuccess }: { item: any, onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    sku: item.sku,
    name: item.name,
    description: item.description || '',
    unit_price: item.unit_price,
    default_vendor_id: item.default_vendor_id || null,
    reorder_point: item.reorder_point || 0,
    hsn_code: item.hsn_code || '',
    category: item.category,
    uom: item.uom,
    gst_rate: item.gst_rate,
    mpn: item.mpn || '',
    oem: item.oem || '',
    footprint: item.footprint || '',
    bin_location: item.bin_location || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['unit_price', 'reorder_point', 'gst_rate'].includes(name) ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateItem(item.id, formData)
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
          <h2 className="text-xl font-bold text-gray-800">Edit Item Catalog</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SKU</label>
              <input required type="text" name="sku" value={formData.sku} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit Price</label>
              <input required type="number" step="0.01" name="unit_price" value={formData.unit_price} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <input required type="text" name="category" value={formData.category} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">UoM</label>
              <input required type="text" name="uom" value={formData.uom} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">GST Rate (%)</label>
              <input required type="number" name="gst_rate" value={formData.gst_rate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MPN</label>
              <input type="text" name="mpn" value={formData.mpn} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bin Location</label>
              <input type="text" name="bin_location" value={formData.bin_location} onChange={handleChange} className={inputClass} />
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
