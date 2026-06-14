import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Plus, Trash2, Calendar, FileText, CheckCircle2, ChevronRight, PenTool, XCircle, Info, RefreshCw, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getGLJournals, postGLJournal, reverseGLJournal, getGLAccounts } from '../../api';

interface GLAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
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
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  lines: JournalLine[];
}

interface FormLine {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  narration: string;
}

const JournalEntries: React.FC = () => {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);

  // Composer Modal State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeDate, setComposeDate] = useState(new Date().toISOString().split('T')[0]);
  const [composeNarration, setComposeNarration] = useState('');
  const [composeLines, setComposeLines] = useState<FormLine[]>([
    { account_id: '', debit_amount: '', credit_amount: '', narration: '' },
    { account_id: '', debit_amount: '', credit_amount: '', narration: '' },
  ]);
  const [posting, setPosting] = useState(false);

  const fetchJournals = async () => {
    setLoading(true);
    try {
      const res = await getGLJournals();
      setJournals(res.data);
      if (res.data.length > 0 && !selectedJournal) {
        setSelectedJournal(res.data[0]);
      }
    } catch (err) {
      toast.error('Failed to load G/L Journals.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await getGLAccounts();
      setAccounts(res.data);
    } catch (err) {
      toast.error('Failed to fetch accounts list.');
    }
  };

  useEffect(() => {
    fetchJournals();
    fetchAccounts();
  }, []);

  const handleAddLine = () => {
    setComposeLines([...composeLines, { account_id: '', debit_amount: '', credit_amount: '', narration: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (composeLines.length <= 2) {
      toast.error('A journal entry must contain at least 2 lines.');
      return;
    }
    const updated = composeLines.filter((_, idx) => idx !== index);
    setComposeLines(updated);
  };

  const handleLineChange = (index: number, field: keyof FormLine, value: string) => {
    const updated = composeLines.map((line, idx) => {
      if (idx !== index) return line;
      
      // Clean up values: if debit is inputted, clear credit and vice versa
      if (field === 'debit_amount' && value !== '') {
        return { ...line, [field]: value, credit_amount: '' };
      }
      if (field === 'credit_amount' && value !== '') {
        return { ...line, [field]: value, debit_amount: '' };
      }
      
      return { ...line, [field]: value };
    });
    setComposeLines(updated);
  };

  // Parity Calculation
  const totalDebits = composeLines.reduce((sum, line) => sum + (parseFloat(line.debit_amount) || 0), 0);
  const totalCredits = composeLines.reduce((sum, line) => sum + (parseFloat(line.credit_amount) || 0), 0);
  const imbalance = Math.abs(totalDebits - totalCredits);
  const isBalanced = imbalance < 0.0001 && totalDebits > 0;

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      toast.error('Journal entry is out of balance.');
      return;
    }
    if (!composeNarration.trim()) {
      toast.error('Please enter a voucher narration.');
      return;
    }
    
    // Check fields are completed
    const invalidLine = composeLines.find(line => !line.account_id || (!line.debit_amount && !line.credit_amount));
    if (invalidLine) {
      toast.error('Each line must specify a GL Account and either a Debit or Credit amount.');
      return;
    }

    setPosting(true);
    try {
      const payload = {
        entry_date: new Date(composeDate).toISOString(),
        narration: composeNarration.trim(),
        lines: composeLines.map(l => ({
          account_id: l.account_id,
          debit_amount: parseFloat(l.debit_amount) || 0,
          credit_amount: parseFloat(l.credit_amount) || 0,
          narration: l.narration.trim() || null
        }))
      };

      await postGLJournal(payload);
      toast.success('Journal Entry posted successfully.');
      setShowComposeModal(false);
      setComposeNarration('');
      setComposeLines([
        { account_id: '', debit_amount: '', credit_amount: '', narration: '' },
        { account_id: '', debit_amount: '', credit_amount: '', narration: '' },
      ]);
      fetchJournals();
    } catch (err) {
      // Global axios response interceptor pops toasts automatically
    } finally {
      setPosting(false);
    }
  };

  const handleReverseJournal = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to reverse this journal entry? This will post an offset reversal journal and mark the original reversed. This is immutable.')) {
      return;
    }
    try {
      const res = await reverseGLJournal(entryId);
      toast.success(res.data.message || 'Journal Entry reversed.');
      fetchJournals();
      setSelectedJournal(null);
    } catch (err) {
      // Intercepted
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" /> Manual Journal Workspace
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Audit-trail view of General Ledger journals, reversals, and new manual double-entry postings</p>
        </div>

        <button
          onClick={() => setShowComposeModal(true)}
          className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 justify-center transition-all"
        >
          <PenTool className="w-4 h-4" /> Compose Journal Entry
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Lists of Journals */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Vouchers Stream</h3>

          {loading && journals.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
              Locating journals...
            </div>
          ) : journals.length === 0 ? (
            <div className="text-center py-8 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 text-xs">
              No journal entries found in this ledger period.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {journals.map(journal => {
                const isSelected = selectedJournal?.entry_id === journal.entry_id;
                return (
                  <div
                    key={journal.entry_id}
                    onClick={() => setSelectedJournal(journal)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 text-xs ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50/20 shadow-sm' 
                        : 'border-slate-200 bg-white hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-slate-900">{journal.entry_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider ${
                        journal.status === 'POSTED' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : journal.status === 'REVERSED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {journal.status}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 font-semibold line-clamp-1">
                      {journal.narration || 'No description provided'}
                    </p>

                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> 
                        {new Date(journal.entry_date).toLocaleDateString()}
                      </span>
                      <span className="text-slate-500 uppercase">{journal.source_module}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Drilldown & Lines Viewer */}
        <div className="lg:col-span-2 space-y-6">
          {selectedJournal ? (
            <>
              {/* Voucher Detail Header */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-5">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">VOUCHER REFERENCE</span>
                    <h2 className="text-lg font-black text-slate-900 leading-none">{selectedJournal.entry_number}</h2>
                    <span className="text-[10px] text-slate-400 font-bold block mt-1">
                      Source Module: <strong className="text-slate-700">{selectedJournal.source_module}</strong> ({selectedJournal.source_event})
                    </span>
                  </div>
                  
                  {selectedJournal.status === 'POSTED' && (
                    <button
                      onClick={() => handleReverseJournal(selectedJournal.entry_id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 text-[10px] font-black rounded-lg shadow-sm transition-all uppercase"
                    >
                      Reverse Posting
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Posting Date</span>
                    <span className="text-slate-800 font-extrabold block mt-0.5">{new Date(selectedJournal.entry_date).toLocaleDateString()}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl col-span-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Narration</span>
                    <span className="text-slate-800 font-bold block mt-0.5 line-clamp-2">{selectedJournal.narration || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Journal Lines Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" /> Balanced Journal Bookkeeping Lines
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-4 py-3">GL Account Code & Description</th>
                        <th className="px-4 py-3 text-right">Debit (₹)</th>
                        <th className="px-4 py-3 text-right">Credit (₹)</th>
                        <th className="px-4 py-3">Details Narration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {selectedJournal.lines.map((line) => (
                        <tr key={line.line_id} className="hover:bg-slate-50/20">
                          <td className="px-4 py-4">
                            <span className="font-bold text-slate-900 font-mono text-xs">{line.account_code}</span>
                            <span className={`text-[11px] block ${line.debit > 0 ? 'text-blue-600 font-bold' : 'text-slate-600 ml-4'}`}>
                              {line.account_name}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {line.debit > 0 ? `₹${line.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {line.credit > 0 ? `₹${line.credit.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-4 text-slate-400 text-[10px]">
                            {line.narration || '-'}
                          </td>
                        </tr>
                      ))}

                      {/* Balanced Total Check row */}
                      <tr className="bg-slate-50/50 border-t border-slate-200 font-black text-slate-900 text-xs">
                        <td className="px-4 py-4">Verification Balances</td>
                        <td className="px-4 py-4 text-right text-blue-600">
                          ₹{selectedJournal.lines.reduce((sum, x) => sum + x.debit, 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-right text-blue-600">
                          ₹{selectedJournal.lines.reduce((sum, x) => sum + x.credit, 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-emerald-600 text-[9px] uppercase tracking-wider">
                          ✓ Double-entry Balanced
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-150 shadow-sm text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Select a Journal Entry</h3>
              <p className="text-xs text-slate-400 mt-1">Select a voucher reference to inspect accounting splits and audit trails.</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Journal Entry Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  <PenTool className="w-5 h-5 text-blue-600" /> Compose Journal Voucher
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Prepare double-entry general ledger debit and credit manual allocations</p>
              </div>
              <button 
                onClick={() => setShowComposeModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostJournal} className="space-y-6 text-xs font-semibold">
              
              {/* Header Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold block">Voucher Posting Date</label>
                  <input
                    type="date"
                    value={composeDate}
                    onChange={(e) => setComposeDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 font-semibold text-xs"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-700 font-bold block">General Narration / Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Month-end depreciation adjustment for IT assets"
                    value={composeNarration}
                    onChange={(e) => setComposeNarration(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 font-semibold text-xs"
                  />
                </div>
              </div>

              {/* Parity Ledger Composer Lines */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Ledger Allocations</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-250 text-[10px] font-black tracking-wide flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Allocation Line
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {composeLines.map((line, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150 items-center justify-between">
                      {/* Account selection */}
                      <div className="flex-1 w-full">
                        <select
                          value={line.account_id}
                          onChange={(e) => handleLineChange(index, 'account_id', e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-white font-bold text-xs"
                        >
                          <option value="">-- Choose GL Account --</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              ({acc.code}) {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Debit */}
                      <div className="w-full md:w-32">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Debit (₹)"
                          value={line.debit_amount}
                          onChange={(e) => handleLineChange(index, 'debit_amount', e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-white text-xs font-semibold text-right"
                        />
                      </div>

                      {/* Credit */}
                      <div className="w-full md:w-32">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Credit (₹)"
                          value={line.credit_amount}
                          onChange={(e) => handleLineChange(index, 'credit_amount', e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-white text-xs font-semibold text-right"
                        />
                      </div>

                      {/* Line Narration */}
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          placeholder="Line details narration (optional)"
                          value={line.narration}
                          onChange={(e) => handleLineChange(index, 'narration', e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-white text-xs font-semibold"
                        />
                      </div>

                      {/* Remove Line */}
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1.5"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parity validation summary footer */}
              <div className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold bg-slate-50/50 border-slate-200">
                <div className="flex gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Total Debits</span>
                    <span className="text-sm font-black text-blue-600">₹{totalDebits.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Total Credits</span>
                    <span className="text-sm font-black text-blue-600">₹{totalCredits.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isBalanced ? (
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5" /> BALANCED & POSTABLE
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-150 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <XCircle className="w-3.5 h-3.5" /> OUT OF BALANCE BY ₹{imbalance.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Form submit button actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel Compose
                </button>
                <button
                  type="submit"
                  disabled={posting || !isBalanced}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  {posting ? 'Posting Voucher...' : 'Post Manual Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalEntries;
