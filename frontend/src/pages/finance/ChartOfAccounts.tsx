import React, { useState, useEffect } from 'react';
import { 
  FolderTree, Calendar, Plus, Search, ShieldAlert, CheckCircle2, Lock, Unlock, XCircle, Info, RefreshCw, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getGLAccounts, createGLAccount, getGLPeriods, updateGLPeriodStatus, 
  getGLFiscalYears, createGLFiscalYear, updateGLFiscalYearStatus 
} from '../../api';

interface GLAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_active: boolean;
  parent_account_id: string | null;
}

interface AccountingPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  fiscal_year_id: string | null;
  fiscal_year_name: string | null;
}

interface FiscalYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
}

const ChartOfAccounts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'coa' | 'periods' | 'fiscalYears'>('coa');
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search & Filters for COA
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modal State for GL Account
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('ASSET');
  const [parentAccountId, setParentAccountId] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Modal State for Fiscal Year
  const [showCreateFYModal, setShowCreateFYModal] = useState(false);
  const [newFYName, setNewFYName] = useState('');
  const [newFYStartDate, setNewFYStartDate] = useState('');
  const [newFYEndDate, setNewFYEndDate] = useState('');
  const [newFYStatus, setNewFYStatus] = useState('OPEN');
  const [creatingFY, setCreatingFY] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await getGLAccounts();
      setAccounts(res.data);
    } catch (err) {
      toast.error('Failed to retrieve Chart of Accounts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const res = await getGLPeriods();
      setPeriods(res.data);
    } catch (err) {
      toast.error('Failed to load accounting periods.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiscalYears = async () => {
    setLoading(true);
    try {
      const res = await getGLFiscalYears();
      setFiscalYears(res.data);
    } catch (err) {
      toast.error('Failed to load fiscal years.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'coa') {
      fetchAccounts();
    } else if (activeTab === 'periods') {
      fetchPeriods();
    } else {
      fetchFiscalYears();
    }
  }, [activeTab]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountCode.trim() || !newAccountName.trim()) {
      toast.error('All fields are required.');
      return;
    }
    
    // Validation
    if (!/^\d+$/.test(newAccountCode)) {
      toast.error('Account Code must be numeric (e.g. 1200).');
      return;
    }

    setCreatingAccount(true);
    try {
      await createGLAccount({
        code: newAccountCode.trim(),
        name: newAccountName.trim(),
        account_type: newAccountType,
        parent_account_id: parentAccountId ? parentAccountId : undefined
      });
      toast.success('GL Account created successfully.');
      setShowCreateModal(false);
      setNewAccountCode('');
      setNewAccountName('');
      setParentAccountId('');
      fetchAccounts();
    } catch (err) {
      // Errors handled by Axios interceptor
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleTogglePeriodStatus = async (periodId: string, currentStatus: string, newStatus: string) => {
    try {
      await updateGLPeriodStatus(periodId, newStatus);
      toast.success(`Period status updated to ${newStatus}.`);
      fetchPeriods();
    } catch (err) {
      // Handled globally
    }
  };

  const handleCreateFY = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFYName.trim() || !newFYStartDate || !newFYEndDate) {
      toast.error('All fields are required.');
      return;
    }
    setCreatingFY(true);
    try {
      await createGLFiscalYear({
        name: newFYName.trim(),
        start_date: newFYStartDate,
        end_date: newFYEndDate,
        status: newFYStatus
      });
      toast.success('Fiscal Year created successfully.');
      setShowCreateFYModal(false);
      setNewFYName('');
      setNewFYStartDate('');
      setNewFYEndDate('');
      fetchFiscalYears();
    } catch (err) {
      // handled
    } finally {
      setCreatingFY(false);
    }
  };

  const handleUpdateFYStatus = async (fyId: string, status: string) => {
    try {
      await updateGLFiscalYearStatus(fyId, status);
      toast.success(`Fiscal Year status updated to ${status}.`);
      fetchFiscalYears();
    } catch (err) {
      // handled
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          acc.code.includes(searchQuery);
    const matchesType = typeFilter === '' || acc.account_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getParentAccountText = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = accounts.find(a => a.id === parentId);
    return parent ? `${parent.code} - ${parent.name}` : parentId;
  };

  // Category specific styles
  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'ASSET': return 'bg-sky-50 text-sky-700 border-sky-150';
      case 'LIABILITY': return 'bg-amber-50 text-amber-700 border-amber-150';
      case 'EQUITY': return 'bg-indigo-50 text-indigo-700 border-indigo-150';
      case 'REVENUE': return 'bg-emerald-50 text-emerald-700 border-emerald-150';
      case 'EXPENSE': return 'bg-rose-50 text-rose-700 border-rose-150';
      default: return 'bg-slate-50 text-slate-700 border-slate-150';
    }
  };

  const getPeriodStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-emerald-50 text-emerald-700 border-emerald-150 flex items-center gap-1';
      case 'CLOSED': return 'bg-amber-50 text-amber-700 border-amber-150 flex items-center gap-1';
      case 'LOCKED': return 'bg-rose-50 text-rose-700 border-rose-150 flex items-center gap-1';
      default: return 'bg-slate-50 text-slate-700 border-slate-150';
    }
  };

  const getFYStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-emerald-50 text-emerald-700 border-emerald-150 flex items-center gap-1';
      case 'CLOSING': return 'bg-amber-50 text-amber-700 border-amber-150 flex items-center gap-1';
      case 'CLOSED': return 'bg-rose-50 text-rose-700 border-rose-150 flex items-center gap-1';
      default: return 'bg-slate-50 text-slate-700 border-slate-150';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-blue-600" /> Chart of Accounts & Period Locks
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Configure central General Ledger accounts, Fiscal Years, and enforce period-based posting constraints</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('coa')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'coa' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" /> GL Accounts
          </button>
          <button
            onClick={() => setActiveTab('fiscalYears')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'fiscalYears' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Fiscal Years
          </button>
          <button
            onClick={() => setActiveTab('periods')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'periods' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Accounting Periods
          </button>
        </div>
      </div>

      {activeTab === 'coa' && (
        <>
          {/* Search, Filters, Create Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-1 flex-col md:flex-row gap-3 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search accounts by code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-colors font-semibold"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:bg-white text-slate-700 font-semibold"
              >
                <option value="">-- All Types --</option>
                <option value="ASSET">Assets</option>
                <option value="LIABILITY">Liabilities</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expenses</option>
              </select>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 w-full md:w-auto justify-center transition-all"
            >
              <Plus className="w-4 h-4" /> Create GL Account
            </button>
          </div>

          {/* Accounts Table */}
          {loading && accounts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Fetching Chart of Accounts...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">No Accounts Found</h3>
              <p className="text-xs text-slate-400 mt-1">Refine your filters or create a new general ledger account above.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-55 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Account Code</th>
                      <th className="px-6 py-4">Account Description</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Parent Account</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {filteredAccounts.map(acc => (
                      <tr key={acc.id} className="hover:bg-slate-50/20">
                        <td className="px-6 py-4 font-bold text-slate-900 font-mono text-sm">{acc.code}</td>
                        <td className="px-6 py-4 text-slate-800">{acc.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] font-black tracking-wider ${getBadgeStyle(acc.account_type)}`}>
                            {acc.account_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-mono">
                          {getParentAccountText(acc.parent_account_id)}
                        </td>
                        <td className="px-6 py-4">
                          {acc.is_active ? (
                            <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Active</span>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1"><XCircle className="w-4 h-4" /> Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'fiscalYears' && (
        /* Fiscal Years management tab */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
              <Info className="w-4 h-4 text-blue-600" />
              Configure annual accounting boundaries. Closed status blocks all postings.
            </div>
            <button
              onClick={() => setShowCreateFYModal(true)}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Fiscal Year
            </button>
          </div>

          {loading && fiscalYears.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading Fiscal Years...
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-55 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">FY Name</th>
                      <th className="px-6 py-4">Start Date</th>
                      <th className="px-6 py-4">End Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Lock Control Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {fiscalYears.map(fy => (
                      <tr key={fy.id} className="hover:bg-slate-50/20">
                        <td className="px-6 py-4 font-bold text-slate-900">{fy.name}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(fy.start_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(fy.end_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] font-black tracking-wider ${getFYStatusBadge(fy.status)}`}>
                            {fy.status === 'OPEN' && <Unlock className="w-2.5 h-2.5" />}
                            {fy.status === 'CLOSING' && <Info className="w-2.5 h-2.5" />}
                            {fy.status === 'CLOSED' && <Lock className="w-2.5 h-2.5" />}
                            {fy.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                            <button
                              onClick={() => handleUpdateFYStatus(fy.id, 'OPEN')}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                                fy.status === 'OPEN' 
                                  ? 'bg-emerald-50 text-emerald-700' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              OPEN
                            </button>
                            <button
                              onClick={() => handleUpdateFYStatus(fy.id, 'CLOSING')}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                                fy.status === 'CLOSING' 
                                  ? 'bg-amber-50 text-amber-700' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              CLOSING
                            </button>
                            <button
                              onClick={() => handleUpdateFYStatus(fy.id, 'CLOSED')}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                                fy.status === 'CLOSED' 
                                  ? 'bg-rose-50 text-rose-700' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              CLOSED
                            </button>
                          </div>
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

      {activeTab === 'periods' && (
        /* Accounting Periods tab */
        <div className="space-y-6">
          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex gap-3 text-xs text-blue-700 leading-relaxed max-w-4xl">
            <Info className="w-4.5 h-4.5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <span className="font-bold">Period Lock Control:</span> Locked and Closed periods prevent any manual postings or procurement ledger entry integrations. 
              Accounting Periods are associated with Fiscal Years.
            </div>
          </div>

          {loading && periods.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Loading Accounting Periods...
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-55 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Period Name</th>
                      <th className="px-6 py-4">Fiscal Year</th>
                      <th className="px-6 py-4">Start Date</th>
                      <th className="px-6 py-4">End Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Lock Control Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {periods.map(period => (
                      <tr key={period.id} className="hover:bg-slate-50/20">
                        <td className="px-6 py-4 font-bold text-slate-900">{period.period_name}</td>
                        <td className="px-6 py-4 text-slate-600">{period.fiscal_year_name || '-'}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(period.start_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(period.end_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] font-black tracking-wider ${getPeriodStatusBadge(period.status)}`}>
                            {period.status === 'OPEN' && <Unlock className="w-2.5 h-2.5" />}
                            {period.status === 'CLOSED' && <Lock className="w-2.5 h-2.5" />}
                            {period.status === 'LOCKED' && <ShieldAlert className="w-2.5 h-2.5" />}
                            {period.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                            <button
                              onClick={() => handleTogglePeriodStatus(period.id, period.status, 'OPEN')}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                                period.status === 'OPEN' 
                                  ? 'bg-emerald-50 text-emerald-700' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              OPEN
                            </button>
                            <button
                              onClick={() => handleTogglePeriodStatus(period.id, period.status, 'CLOSED')}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                                period.status === 'CLOSED' 
                                  ? 'bg-amber-50 text-amber-700' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              CLOSE
                            </button>
                            <button
                              onClick={() => handleTogglePeriodStatus(period.id, period.status, 'LOCKED')}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                                period.status === 'LOCKED' 
                                  ? 'bg-rose-50 text-rose-700' 
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              LOCK
                            </button>
                          </div>
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

      {/* Account Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Create GL Account</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Define a new account ledger code mapping</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Account Code (Numeric Only)</label>
                <input
                  type="text"
                  placeholder="e.g. 1250"
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-colors font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Account Description Name</label>
                <input
                  type="text"
                  placeholder="e.g. GST Input IGST Account"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-colors font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Account Category Type</label>
                <select
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-colors font-semibold"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Parent Account (Optional)</label>
                <select
                  value={parentAccountId}
                  onChange={(e) => setParentAccountId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white text-slate-700 font-semibold"
                >
                  <option value="">-- No Parent (Root Account) --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} ({acc.account_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  {creatingAccount ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fiscal Year Creation Modal */}
      {showCreateFYModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Create Fiscal Year</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Define a new fiscal accounting year</p>
              </div>
              <button 
                onClick={() => setShowCreateFYModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFY} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">FY Name</label>
                <input
                  type="text"
                  placeholder="e.g. FY 2026"
                  value={newFYName}
                  onChange={(e) => setNewFYName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Start Date</label>
                <input
                  type="date"
                  value={newFYStartDate}
                  onChange={(e) => setNewFYStartDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">End Date</label>
                <input
                  type="date"
                  value={newFYEndDate}
                  onChange={(e) => setNewFYEndDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Status</label>
                <select
                  value={newFYStatus}
                  onChange={(e) => setNewFYStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSING">CLOSING</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateFYModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFY}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  {creatingFY ? 'Creating...' : 'Create FY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
