import { useEffect, useState } from 'react';
import { getPOs, issuePO } from '../api';
import { Link } from 'react-router-dom';

interface PO {
  id: string;
  po_number: string;
  vendor_id: string;
  status: string;
  total_amount: number;
}

export default function POList() {
  const [pos, setPos] = useState<PO[]>([]);

  const fetchPOs = () => {
    getPOs().then(res => setPos(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchPOs();
  }, []);

  const handleIssue = (id: string) => {
    issuePO(id).then(() => fetchPOs()).catch(console.error);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Purchase Orders</h1>
        <Link to="/pos/new" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">Create PO</Link>
      </div>
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">PO Number</th>
              <th className="px-6 py-3">Vendor ID</th>
              <th className="px-6 py-3">Total Amount</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pos.map(po => (
              <tr key={po.id} className="bg-white border-b">
                <td className="px-6 py-4 font-medium text-gray-900">{po.po_number}</td>
                <td className="px-6 py-4 text-xs font-mono">{po.vendor_id}</td>
                <td className="px-6 py-4 font-bold text-green-600">₹{po.total_amount}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${po.status === 'DRAFT' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                    {po.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {po.status === 'DRAFT' && (
                    <button onClick={() => handleIssue(po.id)} className="text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-xs">Issue</button>
                  )}
                </td>
              </tr>
            ))}
            {pos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">No Purchase Orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
