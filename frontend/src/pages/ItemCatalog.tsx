import { useEffect, useState } from 'react';
import { getItems } from "../api";
import AddItemForm from '../components/AddItemForm';
import EditItemModal from '../components/EditItemModal';
import { useAuth } from "../AuthContext";

interface Item {
  id: string;
  sku: string;
  name: string;
  unit_price: number;
  category: string;
  mpn?: string | null;
  bin_location?: string | null;
  hsn_code?: string | null;
  inventory_ledger?: {
    quantity_on_hand: number;
    quantity_reserved: number;
    reorder_point: number;
  } | null;
}

export default function ItemCatalog() {
  const [items, setItems] = useState<Item[]>([]);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const { role } = useAuth();
  const canEdit = role === 'ADMIN' || role === 'BUYER';

  const fetchItems = () => getItems().then(res => setItems(res.data)).catch(console.error);

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Item & Component Catalog</h1>
      </div>

      <div className="mb-10">
        <AddItemForm onSuccess={fetchItems} />
      </div>

      <div className="overflow-x-auto rounded-lg shadow mt-8">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">SKU</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">MPN</th>
              <th className="px-6 py-3">HSN Code</th>
              <th className="px-6 py-3">Unit Price</th>
              <th className="px-6 py-3">Bin Loc</th>
              <th className="px-6 py-3 bg-blue-50">On Hand</th>
              {canEdit && <th className="px-6 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{item.sku}</td>
                <td className="px-6 py-4 text-xs font-medium text-blue-800 bg-blue-50 rounded-md inline-block mt-3">{item.category}</td>
                <td className="px-6 py-4">{item.name}</td>
                <td className="px-6 py-4 text-xs font-mono">{item.mpn || '-'}</td>
                <td className="px-6 py-4 text-xs font-mono text-gray-500">{item.hsn_code || '-'}</td>
                <td className="px-6 py-4">₹{item.unit_price}</td>
                <td className="px-6 py-4 text-xs text-gray-400">{item.bin_location || '-'}</td>
                <td className="px-6 py-4 font-bold text-blue-600 bg-blue-50/30">
                  {item.inventory_ledger?.quantity_on_hand || 0}
                </td>
                {canEdit && (
                  <td className="px-6 py-4">
                    <button onClick={() => setEditingItem(item)} className="text-blue-600 hover:text-blue-900 font-medium text-sm">Edit</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center">No items found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingItem && (
        <EditItemModal 
          item={editingItem} 
          onClose={() => setEditingItem(null)} 
          onSuccess={fetchItems} 
        />
      )}
    </div>
  );
}
