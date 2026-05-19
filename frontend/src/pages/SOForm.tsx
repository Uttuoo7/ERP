import { useEffect, useState } from 'react';
import { getItems, getWarehouses, createSO } from '../api';
import { useNavigate } from 'react-router-dom';

export default function SOForm() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [deliveryType, setDeliveryType] = useState('Warehouse');
  const [warehouseId, setWarehouseId] = useState('');
  
  const [shipping, setShipping] = useState({
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

  const [lineItems, setLineItems] = useState([{ item_id: '', quantity: 1, notes: '' }]);
  const navigate = useNavigate();

  useEffect(() => {
    getItems().then(res => setCatalog(res.data)).catch(console.error);
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
    setLineItems(newItems);
  };

  const addLine = () => setLineItems([...lineItems, { item_id: '', quantity: 1, notes: '' }]);

  const removeLine = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipping.contactName || !shipping.addressLine1 || !shipping.city || !shipping.state || !shipping.pinCode || !shipping.phone) {
      alert("Please fill all required shipping fields.");
      return;
    }
    createSO({ 
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
    }).then(() => navigate('/sales-orders')).catch(console.error);
  };

  const readOnly = deliveryType === 'Warehouse';
  const inputClass = `w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm ${readOnly ? 'bg-gray-100 text-gray-600' : 'bg-white'}`;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Raise Internal Requisition</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-8">

        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 border-b pb-2">Shipping Logistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Type <span className="text-red-500">*</span></label>
              <select value={deliveryType} onChange={handleDeliveryTypeChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 bg-white">
                <option value="Warehouse">Deliver to Internal Warehouse</option>
                <option value="Customer Dropship">Deliver directly to Customer (Dropship)</option>
              </select>
            </div>

            {deliveryType === 'Warehouse' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Warehouse <span className="text-red-500">*</span></label>
                <select required value={warehouseId} onChange={handleWarehouseChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 bg-white">
                  <option value="">Select internal warehouse...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Contact Name <span className="text-red-500">*</span></label>
              <input required type="text" name="contactName" value={shipping.contactName} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Company Name</label>
              <input type="text" name="companyName" value={shipping.companyName} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
              <input required type="text" name="addressLine1" value={shipping.addressLine1} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Address Line 2 <span className="text-red-500">*</span></label>
              <input required type="text" name="addressLine2" value={shipping.addressLine2} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Landmark</label>
              <input type="text" name="landmark" value={shipping.landmark} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">City <span className="text-red-500">*</span></label>
              <input required type="text" name="city" value={shipping.city} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">State <span className="text-red-500">*</span></label>
              <input required type="text" name="state" value={shipping.state} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PIN Code <span className="text-red-500">*</span></label>
              <input required type="text" name="pinCode" value={shipping.pinCode} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone <span className="text-red-500">*</span></label>
              <input required type="text" name="phone" value={shipping.phone} onChange={handleShippingChange} readOnly={readOnly} className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Requisition Items</h3>
          {lineItems.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-3 mb-4 bg-gray-50 p-4 rounded-md shadow-sm border border-gray-100">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Item</label>
                  <select required value={item.item_id} onChange={e => handleItemChange(idx, 'item_id', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm bg-white">
                    <option value="">Select an item...</option>
                    {catalog.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Requested Qty</label>
                  <input type="number" min="1" required value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm bg-white" />
                </div>
                <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors">
                  Delete
                </button>
              </div>
              <div className="w-full mt-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Item Note / Instructions</label>
                <input type="text" value={item.notes} onChange={e => handleItemChange(idx, 'notes', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm bg-white" placeholder="Optional instructions or specifications..." />
              </div>
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1 mt-2">
             <span>+ Add Line Item</span>
          </button>
        </div>

        <div className="border-t pt-6 flex justify-end items-center">
          <button type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded shadow hover:bg-blue-700 font-medium transition-colors">Submit Request</button>
        </div>
      </form>
    </div>
  );
}
