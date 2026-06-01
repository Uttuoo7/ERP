import { useEffect, useState } from 'react';
import { getPOs, getPO, createGRN } from "../api";
import { useNavigate } from 'react-router-dom';

export default function ReceiveGoods() {
  const [pos, setPOs] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [poDetails, setPODetails] = useState<any>(null);
  const [receiveLines, setReceiveLines] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getPOs().then(res => {
      const issued = res.data.filter((po: any) => po.status === 'ISSUED' || po.status === 'PARTIAL_RECEIPT');
      setPOs(issued);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedPOId) {
      getPO(selectedPOId).then(res => {
        setPODetails(res.data);
        const lines = res.data.line_items.map((li: any) => ({
          item_id: li.item_id,
          po_line_item_id: li.id,
          quantity_ordered: li.quantity_ordered,
          quantity_received: li.quantity_received,
          quantity_accepted: 0,
          quantity_rejected: 0
        }));
        setReceiveLines(lines);
      }).catch(console.error);
    } else {
      setPODetails(null);
      setReceiveLines([]);
    }
  }, [selectedPOId]);

  const handleLineChange = (index: number, field: string, value: number) => {
    const newLines = [...receiveLines];
    newLines[index][field] = value;
    setReceiveLines(newLines);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      po_id: selectedPOId,
      received_items: receiveLines.filter(line => line.quantity_accepted > 0 || line.quantity_rejected > 0).map(line => ({
        item_id: line.item_id,
        quantity_accepted: line.quantity_accepted,
        quantity_rejected: line.quantity_rejected
      }))
    };
    
    if (payload.received_items.length === 0) {
      alert("Please enter a received quantity greater than 0 for at least one item.");
      return;
    }

    createGRN(payload).then(() => {
      navigate('/pos');
    }).catch(console.error);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Receive Goods (GRN)</h1>
      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Order</label>
          <select value={selectedPOId} onChange={e => setSelectedPOId(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500">
            <option value="">Select an ISSUED PO...</option>
            {pos.map(po => <option key={po.id} value={po.id}>{po.po_number} (Status: {po.status})</option>)}
          </select>
        </div>

        {poDetails && (
          <form onSubmit={handleSubmit}>
            <h3 className="text-lg font-medium text-gray-900 mb-4 mt-6">Items to Receive</h3>
            <div className="space-y-4">
              {receiveLines.map((line, idx) => (
                <div key={idx} className="flex gap-4 items-center bg-gray-50 p-4 rounded-md border border-gray-200">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">Item ID: {line.item_id.substring(0, 8)}...</div>
                    <div className="text-xs text-gray-500">Ordered: {line.quantity_ordered} | Previously Received: {line.quantity_received}</div>
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Accepted</label>
                    <input type="number" min="0" max={line.quantity_ordered - line.quantity_received} value={line.quantity_accepted} onChange={e => handleLineChange(idx, 'quantity_accepted', parseInt(e.target.value) || 0)} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm" />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty Rejected</label>
                    <input type="number" min="0" value={line.quantity_rejected} onChange={e => handleLineChange(idx, 'quantity_rejected', parseInt(e.target.value) || 0)} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 font-medium transition-colors">Submit GRN</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
