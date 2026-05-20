import React, { useState, useEffect } from 'react';
import { 
  History, Search, FileSpreadsheet, Layers, Filter, Landmark, Info, Tag, Calendar, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getFinancialLedger } from '../api';

const LedgerExplorer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Filters
  const [txTypeFilter, setTxTypeFilter] = useState("");

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await getFinancialLedger({
        transaction_type: txTypeFilter || undefined
      });
      setLedgerTransactions(res.data);
      if (res.data.length > 0 && !selectedTx) {
        setSelectedTx(res.data[0]);
      }
    } catch (err) {
      toast.error("Failed to load double-entry ledger journals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [txTypeFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Financial Ledger Explorer</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Audit-safe double-entry ledger accounting postings and accounting dimensions</p>
        </div>

        {/* Filters panel */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={txTypeFilter}
            onChange={(e) => setTxTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-white text-slate-700 font-semibold"
          >
            <option value="">-- All Transaction Types --</option>
            <option value="AP_INVOICE">AP Invoice Accruals</option>
            <option value="PAYMENT">Vendor Payments</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: List of Vouchers */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Ledger Postings</h3>
          
          {loading && ledgerTransactions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Locating ledger entries...</p>
          ) : ledgerTransactions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No ledger postings matched the criteria.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {ledgerTransactions.map(tx => {
                const isSelected = selectedTx?.id === tx.id;
                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 text-xs ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50/20 shadow-sm' 
                        : 'border-slate-150 bg-white hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-slate-900">{tx.transaction_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                        tx.transaction_type === 'AP_INVOICE' 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {tx.transaction_type}
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(tx.transaction_date).toLocaleDateString()}</span>
                      <span className="font-black text-slate-900">₹{parseFloat(tx.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Double Entry Voucher Detail Viewer */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTx ? (
            <>
              {/* Voucher Header Cards */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">VOUCHER NUMBER</span>
                    <h2 className="text-xl font-black text-slate-900">{selectedTx.transaction_number}</h2>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block text-right">VOUCHER TYPE</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200 mt-1 block">
                      {selectedTx.transaction_type}
                    </span>
                  </div>
                </div>

                {/* Dimensions mappings */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Cost Center</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedTx.cost_center?.name || 'Central Purchasing'}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Project / Department</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedTx.project?.name || selectedTx.department?.name || 'Operations'}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Vendor Mapping</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedTx.vendor?.name || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Warehouse Location</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedTx.warehouse?.name || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Double-entry entries table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="w-4.5 h-4.5 text-blue-600" /> Double-Entry General Ledger Postings
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-4 py-3">GL Account Code & Description</th>
                        <th className="px-4 py-3 text-right">Debit (₹)</th>
                        <th className="px-4 py-3 text-right">Credit (₹)</th>
                        <th className="px-4 py-3">Narration Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                      {selectedTx.ledger_entries.map((entry: any) => {
                        const deb = parseFloat(entry.debit_amount);
                        const cred = parseFloat(entry.credit_amount);
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/20">
                            <td className="px-4 py-4">
                              <span className={`text-xs block ${deb > 0 ? 'text-blue-600 font-bold' : 'text-slate-800'}`}>
                                {entry.account_name}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {deb > 0 ? `₹${deb.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {cred > 0 ? `₹${cred.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-4 text-slate-400 text-[11px] leading-relaxed">
                              {entry.narration || '-'}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Summary Balanced Check row */}
                      <tr className="bg-slate-50/50 border-t border-slate-200">
                        <td className="px-4 py-4 font-black text-slate-900">Voucher Balancing Verification</td>
                        <td className="px-4 py-4 text-right font-black text-blue-600">
                          ₹{selectedTx.ledger_entries.reduce((sum: number, x: any) => sum + parseFloat(x.debit_amount), 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-blue-600">
                          ₹{selectedTx.ledger_entries.reduce((sum: number, x: any) => sum + parseFloat(x.credit_amount), 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-emerald-600 font-black text-[10px] flex items-center gap-1.5 mt-1.5 uppercase">
                          <ShieldCheck className="w-4 h-4" /> BALANCED & AUDIT-SAFE
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax Details breakdown if exists */}
              {selectedTx.tax_entries && selectedTx.tax_entries.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <Landmark className="w-4.5 h-4.5 text-blue-600" /> Tax Ledger Reconciliations
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTx.tax_entries.map((tax: any) => (
                      <div key={tax.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between text-xs font-semibold">
                        <div>
                          <span className="font-bold text-slate-800 block">{tax.tax_ledger_name} ({tax.tax_type})</span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Taxable value: ₹{parseFloat(tax.taxable_amount).toFixed(2)} | Rate: {parseFloat(tax.tax_rate)}%</span>
                        </div>
                        <span className="font-black text-slate-900">₹{parseFloat(tax.tax_amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
              <Layers className="w-12 h-12 text-slate-350 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Select Ledger Posting</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Choose a financial journal voucher on the left navigation panel to explore balanced entries and dimensions mapping.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LedgerExplorer;
