import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  FileSpreadsheet, Calendar, Search, ArrowRightLeft, BookOpen, Layers, CheckCircle2, AlertTriangle, ChevronRight, RefreshCw, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getTrialBalance, getGLJournals, getGLAccounts, getAccountLedger } from '../../api';

interface GLAccount {
  id: string;
  code: string;
  name: string;
}

interface TrialBalanceLine {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  net_balance: number;
  balance_type: 'DEBIT' | 'CREDIT';
}

interface TrialBalanceReport {
  lines: TrialBalanceLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

interface JournalLine {
  line_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  narration: string | null;
}

interface JournalEntry {
  entry_id: string;
  entry_number: string;
  entry_date: string;
  reference_type: string;
  reference_id: string | null;
  source_module: string;
  source_event: string;
  narration: string | null;
  status: string;
  lines: JournalLine[];
}

interface AccountLedgerLine {
  line_id: string;
  entry_number: string;
  entry_date: string;
  narration: string;
  debit: number;
  credit: number;
  running_balance: number;
}

interface AccountLedgerReport {
  account_code: string;
  account_name: string;
  account_type: string;
  balance_type: 'DEBIT' | 'CREDIT';
  lines: AccountLedgerLine[];
}

const FinancialReports: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'trial_balance' | 'general_ledger' | 'account_ledger'>('trial_balance');
  const [loading, setLoading] = useState(false);

  // Trial Balance State
  const [tbReport, setTbReport] = useState<TrialBalanceReport | null>(null);

  // General Ledger State
  const [glEntries, setGlEntries] = useState<JournalEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Account Ledger State
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [ledgerReport, setLedgerReport] = useState<AccountLedgerReport | null>(null);

  const fetchTrialBalanceData = async () => {
    setLoading(true);
    try {
      const res = await getTrialBalance();
      setTbReport(res.data);
    } catch (err) {
      toast.error('Failed to load Trial Balance.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneralLedgerData = async () => {
    setLoading(true);
    try {
      const res = await getGLJournals();
      setGlEntries(res.data);
    } catch (err) {
      toast.error('Failed to load General Ledger.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountsList = async () => {
    try {
      const res = await getGLAccounts();
      setAccounts(res.data);
      if (res.data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(res.data[0].id);
      }
    } catch (err) {
      toast.error('Failed to retrieve accounts list.');
    }
  };

  const fetchAccountLedgerData = async (accountId: string) => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await getAccountLedger(accountId);
      setLedgerReport(res.data);
    } catch (err) {
      toast.error('Failed to retrieve Account Ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    const accountIdParam = searchParams.get('accountId');
    if (tabParam === 'account_ledger') {
      setActiveTab('account_ledger');
      if (accountIdParam) {
        setSelectedAccountId(accountIdParam);
      }
    }
  }, [location.search]);

  useEffect(() => {
    if (activeTab === 'trial_balance') {
      fetchTrialBalanceData();
    } else if (activeTab === 'general_ledger') {
      fetchGeneralLedgerData();
    } else if (activeTab === 'account_ledger') {
      fetchAccountsList();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'account_ledger' && selectedAccountId) {
      fetchAccountLedgerData(selectedAccountId);
    }
  }, [selectedAccountId, activeTab]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" /> Financial Reports Workspace
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Audit-ready Trial Balance sheet parity, expanding General Ledger vouchers, and running balance explorers</p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('trial_balance')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'trial_balance' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Trial Balance
          </button>
          <button
            onClick={() => setActiveTab('general_ledger')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'general_ledger' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> General Ledger
          </button>
          <button
            onClick={() => setActiveTab('account_ledger')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'account_ledger' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> Account Ledger
          </button>
        </div>
      </div>

      {activeTab === 'trial_balance' && (
        <div className="space-y-6">
          
          {/* Trial Balance Status Cards */}
          {tbReport && (
            <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold shadow-sm ${
              tbReport.is_balanced 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                : 'bg-rose-50 text-rose-700 border-rose-150'
            }`}>
              <div className="flex gap-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest block opacity-70">Total Debits</span>
                  <span className="text-sm font-black">₹{tbReport.total_debit.toFixed(2)}</span>
                </div>
                <div className="border-l border-current/25 pl-4">
                  <span className="text-[9px] uppercase tracking-widest block opacity-70">Total Credits</span>
                  <span className="text-sm font-black">₹{tbReport.total_credit.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {tbReport.is_balanced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>TRIAL BALANCE BALANCED (DEBITS = CREDITS)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
                    <span>TRIAL BALANCE OUT OF BALANCE (MISMATCH DETECTED)</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          {loading && !tbReport ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Calculating Trial Balance...
            </div>
          ) : !tbReport ? (
            <p className="text-slate-400 text-xs text-center py-12">No data generated.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Account Code</th>
                      <th className="px-6 py-4">Account Name</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4 text-right">Debit Balance (₹)</th>
                      <th className="px-6 py-4 text-right">Credit Balance (₹)</th>
                      <th className="px-6 py-4 text-right">Net Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {tbReport.lines.map(line => (
                      <tr key={line.account_id} className="hover:bg-slate-50/20">
                        <td className="px-6 py-4 font-bold text-slate-900 font-mono text-sm">{line.account_code}</td>
                        <td className="px-6 py-4 text-slate-800">{line.account_name}</td>
                        <td className="px-6 py-4 uppercase text-[10px] text-slate-400">{line.account_type}</td>
                        <td className="px-6 py-4 text-right">{line.debit > 0 ? `₹${line.debit.toFixed(2)}` : '-'}</td>
                        <td className="px-6 py-4 text-right">{line.credit > 0 ? `₹${line.credit.toFixed(2)}` : '-'}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          ₹{line.net_balance.toFixed(2)} <span className="text-[9px] text-slate-400 ml-1">{line.balance_type}</span>
                        </td>
                      </tr>
                    ))}

                    {/* Summary row */}
                    <tr className="bg-slate-50/50 border-t border-slate-200 font-black text-slate-900 text-xs">
                      <td colSpan={3} className="px-6 py-5">Grand Totals verification</td>
                      <td className="px-6 py-5 text-right text-blue-600 text-sm">₹{tbReport.total_debit.toFixed(2)}</td>
                      <td className="px-6 py-5 text-right text-blue-600 text-sm">₹{tbReport.total_credit.toFixed(2)}</td>
                      <td className="px-6 py-5 text-right text-emerald-600">
                        {tbReport.is_balanced ? '✓ Balanced' : '✗ Imbalanced'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'general_ledger' && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Journals Audit Stream</h3>

          {loading && glEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading General Ledger audit logs...
            </div>
          ) : glEntries.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
              No journal entries found in this ledger period.
            </p>
          ) : (
            <div className="space-y-4">
              {glEntries.map(entry => {
                const isExpanded = expandedEntry === entry.entry_id;
                return (
                  <div key={entry.entry_id} className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden text-xs">
                    
                    {/* Entry Header */}
                    <div 
                      onClick={() => setExpandedEntry(isExpanded ? null : entry.entry_id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-95' : ''}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">{entry.entry_number}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider ${
                              entry.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {entry.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold mt-0.5 block">
                            Posting date: {new Date(entry.entry_date).toLocaleDateString()} | Module: <strong className="text-slate-600">{entry.source_module}</strong>
                          </span>
                        </div>
                      </div>

                      <p className="flex-1 md:mx-6 text-[11px] text-slate-500 font-medium line-clamp-1">
                        {entry.narration || 'No narration provided'}
                      </p>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Voucher Total</span>
                        <span className="font-black text-slate-900 text-sm">
                          ₹{entry.lines.reduce((sum, l) => sum + l.debit, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Expandable splits */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/20 p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px] font-semibold text-slate-700">
                            <thead>
                              <tr className="border-b border-slate-150 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-2">GL Account Code & Description</th>
                                <th className="px-4 py-2 text-right">Debit (₹)</th>
                                <th className="px-4 py-2 text-right">Credit (₹)</th>
                                <th className="px-4 py-2">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {entry.lines.map((line) => (
                                <tr key={line.line_id} className="hover:bg-slate-100/30">
                                  <td className="px-4 py-3">
                                    <span className="font-bold text-slate-800 font-mono">{line.account_code}</span>
                                    <span className={`block ${line.debit > 0 ? 'text-blue-600 font-bold' : 'text-slate-500 ml-3'}`}>
                                      {line.account_name}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {line.debit > 0 ? `₹${line.debit.toFixed(2)}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {line.credit > 0 ? `₹${line.credit.toFixed(2)}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400 text-[10px]">
                                    {line.narration || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'account_ledger' && (
        <div className="space-y-6">
          
          {/* Account Selector */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-150 shadow-sm text-xs font-semibold">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-slate-500 font-bold shrink-0">GL Ledger Account:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white text-slate-800 font-extrabold max-w-sm w-full"
              >
                <option value="">-- Choose Account --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>
            
            {ledgerReport && (
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Ledger Code Type</span>
                <span className="px-2.5 py-0.5 border rounded-full text-[9px] font-black tracking-wider bg-slate-100 border-slate-200">
                  {ledgerReport.account_type}
                </span>
              </div>
            )}
          </div>

          {/* Running Balance Ledger Sheet */}
          {loading && !ledgerReport ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Retrieving Ledger entries...
            </div>
          ) : !ledgerReport ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
              <ArrowRightLeft className="w-12 h-12 text-slate-350 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Select an Account</h3>
              <p className="text-xs text-slate-400 mt-1">Please select a general ledger account from the dropdown above to load the running balance sheet.</p>
            </div>
          ) : ledgerReport.lines.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">No Postings Yet</h3>
              <p className="text-xs text-slate-400 mt-1">No postings have been recorded for account <strong>{ledgerReport.account_code} - {ledgerReport.account_name}</strong> in this period.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden text-xs font-semibold">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Posting Date</th>
                      <th className="px-6 py-4">Voucher No.</th>
                      <th className="px-6 py-4">Transaction Details Narration</th>
                      <th className="px-6 py-4 text-right">Debit (₹)</th>
                      <th className="px-6 py-4 text-right">Credit (₹)</th>
                      <th className="px-6 py-4 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {ledgerReport.lines.map(line => (
                      <tr key={line.line_id} className="hover:bg-slate-50/20">
                        <td className="px-6 py-4 text-slate-500">{new Date(line.entry_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold text-slate-900 font-mono">{line.entry_number}</td>
                        <td className="px-6 py-4 text-slate-600 text-[11px] leading-relaxed max-w-sm truncate">{line.narration}</td>
                        <td className="px-6 py-4 text-right text-blue-600">{line.debit > 0 ? `₹${line.debit.toFixed(2)}` : '-'}</td>
                        <td className="px-6 py-4 text-right text-rose-600">{line.credit > 0 ? `₹${line.credit.toFixed(2)}` : '-'}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">
                          ₹{line.running_balance.toFixed(2)}
                          <span className="text-[9px] text-slate-400 font-bold ml-1">{ledgerReport.balance_type}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default FinancialReports;
