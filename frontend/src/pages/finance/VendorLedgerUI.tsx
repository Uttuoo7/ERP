import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Download, Filter } from 'lucide-react';
import api from "../../api";

export function VendorLedgerUI() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [ledger, setLedger] = useState<any[]>([]);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchLedger(selectedVendorId);
    } else {
      setLedger([]);
    }
  }, [selectedVendorId]);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLedger = async (vendorId: string) => {
    try {
      const res = await api.get(`/finance/vendor-ledger/${vendorId}`);
      setLedger(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            Vendor Ledger & Statements
          </h1>
          <p className="text-slate-500 mt-1">Immutable financial ledger and running balances.</p>
        </div>
        <div className="flex gap-3">
          <select 
            className="border-slate-200 rounded-lg text-sm shadow-sm p-2 w-64"
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
          >
            <option value="">Select a Vendor...</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
            ))}
          </select>
          <button className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-200 transition">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition">
            <Download className="w-4 h-4" /> Export Statement
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[700px] flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <span className="font-bold text-slate-700">Statement of Account</span>
          <span className="text-sm font-medium text-slate-500">{ledger.length} Transactions</span>
        </div>
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr className="text-sm text-slate-500 border-b border-slate-200">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Txn Type</th>
                <th className="p-4 font-medium">Reference</th>
                <th className="p-4 font-medium">Remarks</th>
                <th className="p-4 font-medium text-right bg-rose-50 text-rose-700">Debit (DR)</th>
                <th className="p-4 font-medium text-right bg-emerald-50 text-emerald-700">Credit (CR)</th>
                <th className="p-4 font-bold text-right text-indigo-700 bg-indigo-50">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50 text-sm">
                  <td className="p-4 text-slate-600">{new Date(entry.transaction_date).toLocaleDateString()}</td>
                  <td className="p-4 font-bold text-slate-700">{entry.transaction_type}</td>
                  <td className="p-4 text-indigo-600 font-medium">{entry.reference_type}</td>
                  <td className="p-4 text-slate-500">{entry.remarks || '-'}</td>
                  <td className="p-4 text-right text-rose-600 font-medium">{entry.debit_amount > 0 ? entry.debit_amount : ''}</td>
                  <td className="p-4 text-right text-emerald-600 font-medium">{entry.credit_amount > 0 ? entry.credit_amount : ''}</td>
                  <td className="p-4 text-right font-black text-slate-800">{entry.running_balance}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    {selectedVendorId ? "No transactions found for this vendor." : "Select a vendor to view their statement."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
