import React, { useState } from 'react';
import { createVendor } from '../api';

export default function AddVendorForm({ onSuccess }: { onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    vendorName: '',
    vendorType: 'Goods',
    onboardingStatus: 'Live',
    gstin: '',
    pan: '',
    udyamRegNo: '',
    isMsme: false,
    firstName: '',
    lastName: '',
    officialEmail: '',
    mobileNumber: '+91 ',
    bankAccountNo: '',
    ifscCode: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked as any;
    } else if (name === 'ifscCode' || name === 'pan' || name === 'gstin') {
      processedValue = value.toUpperCase();
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.vendorName) newErrors.vendorName = 'Required';
    
    if (!formData.gstin) {
      newErrors.gstin = 'Required';
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format';
    }

    if (!formData.pan) {
      newErrors.pan = 'Required';
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)) {
      newErrors.pan = 'Invalid PAN format';
    }

    if (!formData.firstName) newErrors.firstName = 'Required';
    if (!formData.lastName) newErrors.lastName = 'Required';
    if (!formData.officialEmail) newErrors.officialEmail = 'Required';
    if (!formData.mobileNumber || formData.mobileNumber.trim() === '+91') newErrors.mobileNumber = 'Required';
    
    if (!formData.ifscCode) {
      newErrors.ifscCode = 'Required';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) {
      newErrors.ifscCode = 'Invalid IFSC format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createVendor({
        name: formData.vendorName,
        contact_email: formData.officialEmail,
        contact_phone: formData.mobileNumber,
        default_lead_time_days: 0,
        gstin: formData.gstin,
        pan: formData.pan,
        is_msme: formData.isMsme,
        ifsc_code: formData.ifscCode
      });
      if (onSuccess) onSuccess();
      handleReset();
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 422) {
        alert("Validation error from server. Please check your inputs.");
      } else {
        alert("Failed to add vendor");
      }
    }
  };

  const handleReset = () => {
    setFormData({
      vendorName: '',
      vendorType: 'Goods',
      onboardingStatus: 'Live',
      gstin: '',
      pan: '',
      udyamRegNo: '',
      isMsme: false,
      firstName: '',
      lastName: '',
      officialEmail: '',
      mobileNumber: '+91 ',
      bankAccountNo: '',
      ifscCode: ''
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
        <h2 className="text-2xl font-semibold text-slate-800 mb-8 border-b pb-4">Add Vendor</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-2">
            
            {/* Left Column */}
            <div>
              <div className={rowClass}>
                <label className={labelClass}>Name <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="vendorName" value={formData.vendorName} onChange={handleChange} className={inputClass} placeholder="Zen Desk" />
                  {errors.vendorName && <span className={errorClass}>{errors.vendorName}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Type <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <select name="vendorType" value={formData.vendorType} onChange={handleChange} className={inputClass}>
                    <option value="Goods">Goods</option>
                    <option value="Services">Services</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Status <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <select name="onboardingStatus" value={formData.onboardingStatus} onChange={handleChange} className={inputClass}>
                    <option value="Live">Live</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>GSTIN <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="gstin" value={formData.gstin} onChange={handleChange} className={inputClass} placeholder="27AAAAA0000A1Z5" />
                  {errors.gstin && <span className={errorClass}>{errors.gstin}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>PAN <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="pan" value={formData.pan} onChange={handleChange} className={inputClass} placeholder="ABCDE1234F" />
                  {errors.pan && <span className={errorClass}>{errors.pan}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Udyam Registration No</label>
                <div className="w-2/3">
                  <input type="text" name="udyamRegNo" value={formData.udyamRegNo} onChange={handleChange} className={inputClass} placeholder="UDYAM-XX-00-0000000" />
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Is MSME?</label>
                <div className="w-2/3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="isMsme" checked={formData.isMsme} onChange={handleChange} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <h3 className="font-semibold text-slate-800 text-lg mb-6 pb-2 border-b">Contact Information</h3>
              
              <div className={rowClass}>
                <label className={labelClass}>Contact Name <span className="text-red-500">*</span></label>
                <div className="w-2/3 flex gap-2">
                  <div className="w-1/2">
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClass} placeholder="First Name" />
                    {errors.firstName && <span className={errorClass}>{errors.firstName}</span>}
                  </div>
                  <div className="w-1/2">
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} placeholder="Last Name" />
                    {errors.lastName && <span className={errorClass}>{errors.lastName}</span>}
                  </div>
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Official Email <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="email" name="officialEmail" value={formData.officialEmail} onChange={handleChange} className={inputClass} placeholder="contact@vendor.com" />
                  {errors.officialEmail && <span className={errorClass}>{errors.officialEmail}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Mobile Number <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} className={inputClass} placeholder="+91 9876543210" />
                  {errors.mobileNumber && <span className={errorClass}>{errors.mobileNumber}</span>}
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>Bank Account No</label>
                <div className="w-2/3">
                  <input type="text" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleChange} className={inputClass} />
                </div>
              </div>

              <div className={rowClass}>
                <label className={labelClass}>IFSC Code <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleChange} className={inputClass} placeholder="SBIN0001234" />
                  {errors.ifscCode && <span className={errorClass}>{errors.ifscCode}</span>}
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
