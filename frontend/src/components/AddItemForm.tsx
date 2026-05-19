import React, { useState } from 'react';
import { createItem } from '../api';

export default function AddItemForm({ onSuccess }: { onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Raw Component',
    uom: 'Nos',
    hsn_code: '',
    gst_rate: '18.00',
    unit_price: '',
    reorder_point: '0',
    mpn: '',
    oem: '',
    footprint: '',
    bin_location: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Auto-formatting or constraints
    let processedValue = value;
    if (name === 'hsn_code') {
      processedValue = value.replace(/\D/g, '').substring(0, 8); // Only numeric, max 8 digits
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name) newErrors.name = 'Required';
    if (!formData.sku) newErrors.sku = 'Required';
    if (!formData.category) newErrors.category = 'Required';
    if (!formData.uom) newErrors.uom = 'Required';
    if (!formData.hsn_code) newErrors.hsn_code = 'Required';
    if (!formData.gst_rate) newErrors.gst_rate = 'Required';
    if (!formData.unit_price || isNaN(parseFloat(formData.unit_price))) newErrors.unit_price = 'Invalid Price';
    if (!formData.reorder_point || isNaN(parseInt(formData.reorder_point))) newErrors.reorder_point = 'Invalid Qty';

    // Conditional MPN validation
    if (['Raw Component', 'Sub-Assembly'].includes(formData.category) && !formData.mpn) {
      newErrors.mpn = 'Required for this category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createItem({
        name: formData.name,
        sku: formData.sku,
        category: formData.category,
        uom: formData.uom,
        hsn_code: formData.hsn_code,
        gst_rate: parseFloat(formData.gst_rate),
        unit_price: parseFloat(formData.unit_price),
        reorder_point: parseInt(formData.reorder_point),
        mpn: formData.mpn || undefined,
        oem: formData.oem || undefined,
        footprint: formData.footprint || undefined,
        bin_location: formData.bin_location || undefined
      });
      if (onSuccess) onSuccess();
      handleReset();
    } catch (err: any) {
      console.error(err);
      alert("Failed to add item. SKU might already exist.");
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      sku: '',
      category: 'Raw Component',
      uom: 'Nos',
      hsn_code: '',
      gst_rate: '18.00',
      unit_price: '',
      reorder_point: '0',
      mpn: '',
      oem: '',
      footprint: '',
      bin_location: ''
    });
    setErrors({});
  };

  const inputClass = "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded px-3 py-2 w-full border text-sm transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 w-1/3 pr-4 text-right pt-2";
  const rowClass = "flex items-start mb-6";
  const errorClass = "text-red-500 text-xs mt-1 block";

  return (
    <div className="bg-slate-50 min-h-full p-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-slate-800 mb-8 border-b pb-4">Add Item</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-2">
            
            {/* Left Column */}
            <div>
              <div className={rowClass}>
                <label className={labelClass}>Item Name <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="e.g. ESP32 Microcontroller" />
                  {errors.name && <span className={errorClass}>{errors.name}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>SKU / Item Code <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="sku" value={formData.sku} onChange={handleChange} className={inputClass} placeholder="e.g. COMP-ESP32-01" />
                  {errors.sku && <span className={errorClass}>{errors.sku}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Category <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <select name="category" value={formData.category} onChange={handleChange} className={inputClass}>
                    <option value="Raw Component">Raw Component</option>
                    <option value="Sub-Assembly">Sub-Assembly</option>
                    <option value="Finished Goods">Finished Goods</option>
                    <option value="Operating Supplies/MRO">Operating Supplies/MRO</option>
                    <option value="Office & Admin">Office & Admin</option>
                  </select>
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Unit of Measure (UoM) <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <select name="uom" value={formData.uom} onChange={handleChange} className={inputClass}>
                    <option value="Nos">Nos</option>
                    <option value="Reels">Reels</option>
                    <option value="Meters">Meters</option>
                    <option value="Boxes">Boxes</option>
                  </select>
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>HSN Code <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="hsn_code" value={formData.hsn_code} onChange={handleChange} className={inputClass} placeholder="85423100" />
                  {errors.hsn_code && <span className={errorClass}>{errors.hsn_code}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>GST Rate (%) <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <select name="gst_rate" value={formData.gst_rate} onChange={handleChange} className={inputClass}>
                    <option value="18.00">18%</option>
                    <option value="12.00">12%</option>
                    <option value="5.00">5%</option>
                    <option value="28.00">28%</option>
                    <option value="0.00">0%</option>
                  </select>
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Unit Purchase Price (INR) <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="number" step="0.01" name="unit_price" value={formData.unit_price} onChange={handleChange} className={inputClass} placeholder="0.00" />
                  {errors.unit_price && <span className={errorClass}>{errors.unit_price}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Reorder Point (Qty) <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="number" name="reorder_point" value={formData.reorder_point} onChange={handleChange} className={inputClass} placeholder="100" />
                  {errors.reorder_point && <span className={errorClass}>{errors.reorder_point}</span>}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <h3 className="font-semibold text-slate-800 text-lg mb-6 pb-2 border-b">Electronics & Warehouse Specifications</h3>
              
              <div className={rowClass}>
                <label className={labelClass}>
                  Manufacturer Part Number (MPN)
                  {['Raw Component', 'Sub-Assembly'].includes(formData.category) && <span className="text-red-500"> *</span>}
                </label>
                <div className="w-2/3">
                  <input type="text" name="mpn" value={formData.mpn} onChange={handleChange} className={inputClass} placeholder="e.g. ESP32-WROOM-32" />
                  {errors.mpn && <span className={errorClass}>{errors.mpn}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>OEM / Manufacturer</label>
                <div className="w-2/3">
                  <input type="text" name="oem" value={formData.oem} onChange={handleChange} className={inputClass} placeholder="e.g. Espressif Systems" />
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Footprint / Package</label>
                <div className="w-2/3">
                  <input type="text" name="footprint" value={formData.footprint} onChange={handleChange} className={inputClass} placeholder="e.g. 0603, SOT-23" />
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Warehouse Bin Location</label>
                <div className="w-2/3">
                  <input type="text" name="bin_location" value={formData.bin_location} onChange={handleChange} className={inputClass} placeholder="e.g. WH1-Aisle B-Bin 104" />
                </div>
              </div>
            </div>
            
          </div>
          
          <div className="mt-8 pt-6 border-t flex justify-center lg:justify-start lg:pl-[16.666667%]">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded shadow-sm text-sm transition-colors">
              Submit
            </button>
            <button type="button" onClick={handleReset} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-2 rounded text-sm ml-3 transition-colors border border-gray-200">
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
