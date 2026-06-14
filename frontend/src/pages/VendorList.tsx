import { useEffect, useState } from 'react';
import { getVendors } from "../api";
import AddVendorForm from '../components/AddVendorForm';
import EditVendorModal from '../components/EditVendorModal';
import { useAuth } from "../AuthContext";
import { DataContainer } from '../components/common/DataContainer';
import { useTableDensityStore } from '../store/tableDensityStore';
import { FilterToolbar } from '../components/common/FilterToolbar';
import { EmptyState } from '../components/common/EmptyState';
import { Users } from 'lucide-react';

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
  const [search, setSearch] = useState("");
  const { density } = useTableDensityStore();

  const fetchVendors = () => getVendors().then(res => setVendors(res.data)).catch(console.error);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    (v.contact_email && v.contact_email.toLowerCase().includes(search.toLowerCase()))
  );

  const cellPadding = density === 'compact' ? 'px-4 py-2 text-[13px]' : 'px-6 py-4 text-sm';
  const headerPadding = density === 'compact' ? 'px-4 py-3' : 'px-6 py-4';

  useEffect(() => {
    fetchVendors();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <DataContainer className="p-6">
        <AddVendorForm onSuccess={fetchVendors} />
      </DataContainer>

      <DataContainer>
        <FilterToolbar 
          searchQuery={search} 
          onSearchChange={setSearch} 
          searchPlaceholder="Search vendors by name or email..." 
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-slate-500">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-erp-border text-xs text-slate-700 uppercase">
              <tr>
                <th className={headerPadding}>Name</th>
                <th className={headerPadding}>GSTIN</th>
                <th className={headerPadding}>Email</th>
                <th className={headerPadding}>MSME</th>
                {canEdit && <th className={headerPadding}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-erp-border">
              {filteredVendors.map(vendor => (
                <tr key={vendor.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                  <td className={`${cellPadding} font-bold text-slate-900`}>{vendor.name}</td>
                  <td className={`${cellPadding} font-mono text-xs`}>{vendor.gstin || '-'}</td>
                  <td className={cellPadding}>{vendor.contact_email}</td>
                  <td className={cellPadding}>{vendor.is_msme ? <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">Yes</span> : 'No'}</td>
                  {canEdit && (
                    <td className={cellPadding}>
                      <button onClick={() => setEditingVendor(vendor)} className="text-erp-primary hover:text-blue-800 font-bold text-sm transition-colors">Edit</button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="p-0">
                    <EmptyState 
                      icon={<Users className="w-8 h-8" />} 
                      title="No vendors found" 
                      description="No vendor records match your search criteria." 
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataContainer>
      
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
