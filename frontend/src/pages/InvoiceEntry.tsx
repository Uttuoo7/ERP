import { useEffect, useState } from 'react';
import { getPOs, getPO, createInvoice } from "../api";
import { useNavigate } from 'react-router-dom';

export default function InvoiceEntry() {
  const [pos, setPOs] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [poDetails, setPODetails] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [tdsDeducted, setTdsDeducted] = useState('');
  const [billedItems, setBilledItems] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getPOs().then(res => {
      const active = res.data.filter((po: any) => po.status === 'FULFILLED' || po.status === 'PARTIAL_RECEIPT');
      setPOs(active);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedPOId) {
      getPO(selectedPOId).then(res => {
        setPODetails(res.data);
        const lines = res.data.line_items.map((li: any) => ({
          item_id: li.item_id,
          ordered: li.quantity_ordered,
          received: li.quantity_received,
          po_price: li.unit_price,
          quantity_billed: li.quantity_received, // default to what was received
          unit_price: li.unit_price // default to PO price
        }));
        setBilledItems(lines);
      }).catch(console.error);
    } else {
      setPODetails(null);
      setBilledItems([]);
    }
  }, [selectedPOId]);

  const handleLineChange = (index: number, field: string, value: number) => {
    const newLines = [...billedItems];
    newLines[index][field] = value;
    setBilledItems(newLines);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      po_id: selectedPOId,
      invoice_number: invoiceNumber,
      gst_amount: parseFloat(gstAmount) || 0,
      tds_deducted: parseFloat(tdsDeducted) || 0,
      billed_items: billedItems.filter(line => line.quantity_billed > 0).map(line => ({
        item_id: line.item_id,
        quantity_billed: line.quantity_billed,
        unit_price: line.unit_price
      }))
    };
    
    if (payload.billed_items.length === 0) {
      alert("Please bill at least one item.");
      return;
    }

    createInvoice(payload).then(() => {
      navigate('/invoices');
    }).catch(console.error);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Enter Invoice (3-Way Match)</h1>
      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Order</label>
            <select value={selectedPOId} onChange={e => setSelectedPOId(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500">
              <option value="">Select FULFILLED/PARTIAL PO...</option>
              {pos.map(po => <option key={po.id} value={po.id}>{po.po_number} (Status: {po.status})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Invoice Number</label>
            <input required type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2023-001" className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST Amount (from physical invoice)</label>
            <input required type="number" step="0.01" value={gstAmount} onChange={e => setGstAmount(e.target.value)} placeholder="0.00" className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TDS Deducted</label>
            <input required type="number" step="0.01" value={tdsDeducted} onChange={e => setTdsDeducted(e.target.value)} placeholder="0.00" className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500" />
          </div>
        </div>

        {poDetails && (
          <form onSubmit={handleSubmit}>
            <h3 className="text-lg font-medium text-gray-900 mb-4 mt-6">Match Lines</h3>
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Item ID</th>
                    <th className="px-4 py-3 bg-blue-50">PO Price</th>
                    <th className="px-4 py-3 bg-green-50">Ordered</th>
                    <th className="px-4 py-3 bg-green-100 text-green-800">Received (GRN)</th>
                    <th className="px-4 py-3 border-l-2">Qty Billed</th>
                    <th className="px-4 py-3">Unit Price Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {billedItems.map((line, idx) => (
                    <tr key={idx} className="bg-white border-b">
                      <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[150px]" title={line.item_id}>{line.item_id.substring(0,8)}...</td>
                      <td className="px-4 py-3 bg-blue-50/30 font-bold">₹{line.po_price}</td>
                      <td className="px-4 py-3 bg-green-50/30 font-bold">{line.ordered}</td>
                      <td className="px-4 py-3 bg-green-100/30 font-bold text-green-700">{line.received}</td>
                      <td className="px-4 py-3 border-l-2">
                        <input type="number" min="0" value={line.quantity_billed} onChange={e => handleLineChange(idx, 'quantity_billed', parseInt(e.target.value) || 0)} className="w-20 border-gray-300 rounded shadow-sm p-1 border focus:border-blue-500 focus:ring-blue-500 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" step="0.01" value={line.unit_price} onChange={e => handleLineChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-24 border-gray-300 rounded shadow-sm p-1 border focus:border-blue-500 focus:ring-blue-500 text-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded shadow hover:bg-purple-700 font-medium transition-colors">Submit & Run Match</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
