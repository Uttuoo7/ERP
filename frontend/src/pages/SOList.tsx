import { useEffect, useState } from 'react';
import { getSOs, approveSO, convertSOtoPO } from '../api';
import { Link, useNavigate } from 'react-router-dom';

export default function SOList() {
  const [sos, setSos] = useState<any[]>([]);
  const navigate = useNavigate();

  const fetchSOs = () => {
    getSOs().then(res => setSos(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchSOs();
  }, []);

  const handleApprove = (id: string) => {
    approveSO(id).then(() => fetchSOs()).catch(console.error);
  };

  const handleConvert = (id: string) => {
    convertSOtoPO(id).then(res => {
      const poId = res.data.id;
      navigate(`/pos/${poId}/edit`);
    }).catch(console.error);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Internal Requisitions (Sales Orders)</h1>
        <Link to="/sales-orders/new" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium">Create Requisition</Link>
      </div>
      <div className="overflow-x-auto rounded-lg shadow border border-gray-100">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3">SO Number</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Delivery To</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sos.map(so => (
              <tr key={so.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-blue-600 hover:underline">
                  <Link to={`/sales-orders/${so.id}`}>{so.so_number}</Link>
                </td>
                <td className="px-6 py-4">{new Date(so.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4">{so.delivery_type} - {so.ship_to_city}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${so.status === 'DRAFT' ? 'bg-gray-200 text-gray-700' : so.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {so.status}
                  </span>
                </td>
                <td className="px-6 py-4 space-x-2">
                  {so.status === 'DRAFT' && (
                    <button onClick={() => handleApprove(so.id)} className="text-white bg-gray-800 hover:bg-black px-3 py-1.5 rounded shadow-sm text-xs font-medium transition-colors">Approve</button>
                  )}
                  {so.status === 'APPROVED' && (
                    <button onClick={() => handleConvert(so.id)} className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded shadow-sm text-xs font-medium transition-colors">Convert to PO</button>
                  )}
                  {so.status === 'CONVERTED' && (
                    <span className="text-xs text-gray-400 italic">Converted</span>
                  )}
                </td>
              </tr>
            ))}
            {sos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">No Requisitions found. Create one to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
