import { useEffect, useState } from 'react';
import { getVendors } from "../api";
import AddVendorForm from '../components/AddVendorForm';
import EditVendorModal from '../components/EditVendorModal';
import { useAuth } from "../AuthContext";

interface Vendor {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  default_lead_time_days: number;
  gstin?: string | null;
  is_msme?: boolean;
}

export default function VendorList() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const { role } = useAuth();
  const canEdit = role === 'ADMIN' || role === 'BUYER';

  const fetchVendors = () => getVendors().then(res => setVendors(res.data)).catch(console.error);

  useEffect(() => {
    fetchVendors();
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Vendor Management</h1>
      </div>
      
      <div className="mb-10">
        <AddVendorForm onSuccess={fetchVendors} />
      </div>

      <div className="overflow-x-auto rounded-lg shadow mt-8">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">GSTIN</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">MSME</th>
              {canEdit && <th className="px-6 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr key={vendor.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{vendor.name}</td>
                <td className="px-6 py-4 font-mono text-xs">{vendor.gstin || '-'}</td>
                <td className="px-6 py-4">{vendor.contact_email}</td>
                <td className="px-6 py-4">{vendor.is_msme ? <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">Yes</span> : 'No'}</td>
                {canEdit && (
                  <td className="px-6 py-4">
                    <button onClick={() => setEditingVendor(vendor)} className="text-blue-600 hover:text-blue-900 font-medium text-sm">Edit</button>
                  </td>
                )}
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center">No vendors found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {editingVendor && (
        <EditVendorModal 
          vendor={editingVendor} 
          onClose={() => setEditingVendor(null)} 
          onSuccess={fetchVendors} 
        />
      )}
    </div>
  );
}
