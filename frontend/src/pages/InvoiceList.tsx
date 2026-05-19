import { useEffect, useState } from 'react';
import { getInvoices } from '../api';
import { Link } from 'react-router-dom';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    getInvoices().then(res => setInvoices(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Accounts Payable Invoices</h1>
        <Link to="/invoices/new" className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700">Enter Invoice</Link>
      </div>
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">Invoice Number</th>
              <th className="px-6 py-3">PO ID</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Total Amount</th>
              <th className="px-6 py-3">Match Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className={`border-b ${inv.status === 'DISCREPANCY' ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}`}>
                <td className="px-6 py-4 font-medium text-gray-900">{inv.invoice_number}</td>
                <td className="px-6 py-4 text-xs font-mono text-gray-400">{inv.po_id.substring(0,8)}...</td>
                <td className="px-6 py-4">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td className="px-6 py-4 font-bold text-gray-800">₹{inv.total_amount}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    inv.status === 'MATCHED' ? 'bg-green-100 text-green-700 border border-green-200' :
                    inv.status === 'DISCREPANCY' ? 'bg-red-200 text-red-800 border border-red-300' :
                    'bg-gray-200 text-gray-700 border border-gray-300'
                  }`}>
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">No invoices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
