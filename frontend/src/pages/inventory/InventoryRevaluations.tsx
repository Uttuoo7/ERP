import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Plus, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Calendar, 
  ArrowRight, 
  User, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import api, { getItems } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface Item {
  id: string;
  sku: string;
  name: string;
  standard_rate: number;
}

interface Revaluation {
  id: string;
  item_id: string;
  old_cost: number;
  new_cost: number;
  quantity_affected: number;
  value_difference: number;
  reason: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export default function InventoryRevaluations() {
  const user = useAuthStore(state => state.user);
  const userRole = user?.role || 'EMPLOYEE';
  const canApprove = ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'].includes(userRole);

  const [revaluations, setRevaluations] = useState<Revaluation[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);

  // Form State
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [newCost, setNewCost] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [revalRes, itemsRes] = await Promise.all([
        api.get('/inventory/revaluations'),
        getItems()
      ]);
      setRevaluations(revalRes.data);
      setItems(itemsRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load costing and revaluation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !newCost || !reason) {
      toast.error('Please fill out all fields.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inventory/revaluations', {
        item_id: selectedItemId,
        new_cost: parseFloat(newCost),
        reason
      });
      toast.success('Inventory revaluation proposed successfully as Draft.');
      setShowProposeModal(false);
      setSelectedItemId('');
      setNewCost('');
      setReason('');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await api.post(`/inventory/revaluations/${id}/submit`);
      toast.success('Revaluation proposal submitted for approval.');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/inventory/revaluations/${id}/approve`);
      toast.success('Revaluation proposal approved, ledger updated, and G/L postings created.');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/inventory/revaluations/${id}/reject`);
      toast.success('Revaluation proposal rejected.');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val);
  };

  const getItemName = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    return item ? `${item.name} (${item.sku})` : 'Unknown Item';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            Draft
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Pending Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  // Metrics
  const totalProposed = revaluations.length;
  const pendingApprovals = revaluations.filter(r => r.status === 'SUBMITTED').length;
  const totalValueDiff = revaluations
    .filter(r => r.status === 'APPROVED')
    .reduce((sum, r) => sum + r.value_difference, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Coins className="w-8 h-8 text-blue-600" />
            Inventory Costing Revaluation
          </h1>
          <p className="text-slate-500 mt-1">
            Standard Costing re-rating, manual valuation adjustments, and general ledger reconciliation workflows.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => setShowProposeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-blue-100 transition duration-200"
          >
            <Plus className="w-4 h-4" />
            Propose Revaluation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Proposal Volume</span>
            <h3 className="text-sm font-medium text-slate-700 mt-1">Total Proposals</h3>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-black text-slate-950">{totalProposed}</span>
            <span className="text-xs text-slate-500">requests drafted or finalized</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <span className="text-amber-600 text-xs font-bold uppercase tracking-wider">Awaiting Verification</span>
            <h3 className="text-sm font-medium text-slate-700 mt-1">Pending Approvals</h3>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-black text-amber-600">{pendingApprovals}</span>
            <span className="text-xs text-slate-500">require financial authorization</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md p-6 border border-slate-850 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-emerald-500/20">
            <ShieldCheck className="w-20 h-20" />
          </div>
          <div>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Adjustment Impact</span>
            <h3 className="text-sm font-medium text-slate-200 mt-1">Net Valuation Adjustment</h3>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className={`text-3xl font-black tracking-tight ${totalValueDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(totalValueDiff)}
            </span>
            <span className="text-xs text-slate-400">posted to Inventory G/L</span>
          </div>
        </div>
      </div>

      {/* Revaluations Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Revaluation Registers</h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {revaluations.length} total entries
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-slate-500 text-sm">Fetching revaluation registers...</p>
          </div>
        ) : revaluations.length === 0 ? (
          <div className="text-center py-20">
            <Coins className="w-12 h-12 text-slate-350 mx-auto stroke-[1.5]" />
            <p className="text-slate-500 font-medium mt-4">No revaluations proposed yet.</p>
            <p className="text-slate-400 text-sm mt-1">Use standard cost changes to revalue existing inventory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Item & SKU</th>
                  <th className="px-6 py-3 font-semibold text-right">Old Cost</th>
                  <th className="px-6 py-3 font-semibold text-center"></th>
                  <th className="px-6 py-3 font-semibold text-right">New Cost</th>
                  <th className="px-6 py-3 font-semibold text-right">Quantity Affected</th>
                  <th className="px-6 py-3 font-semibold text-right">Valuation Change</th>
                  <th className="px-6 py-3 font-semibold">Reason</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {revaluations.map(reval => (
                  <tr key={reval.id} className="bg-white border-b border-slate-150 hover:bg-slate-50/50 transition duration-150">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-950">{getItemName(reval.item_id)}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {reval.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">
                      {formatCurrency(reval.old_cost)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ArrowRight className="w-4 h-4 text-slate-350 mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-right font-semibold font-mono text-slate-950">
                      {formatCurrency(reval.new_cost)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      {Number(reval.quantity_affected).toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold font-mono ${reval.value_difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {reval.value_difference >= 0 ? '+' : ''}{formatCurrency(reval.value_difference)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={reval.reason}>
                      {reval.reason}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(reval.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {reval.status === 'DRAFT' && (
                          <button
                            onClick={() => handleSubmit(reval.id)}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition duration-150"
                          >
                            Submit
                          </button>
                        )}
                        {reval.status === 'SUBMITTED' && (
                          <>
                            {canApprove ? (
                              <>
                                <button
                                  onClick={() => handleApprove(reval.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition duration-150"
                                >
                                  <Check className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  onClick={() => handleReject(reval.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 transition duration-150"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Pending approval</span>
                            )}
                          </>
                        )}
                        {reval.status === 'APPROVED' && (
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Posted to G/L</span>
                          </div>
                        )}
                        {reval.status === 'REJECTED' && (
                          <span className="text-xs text-slate-400">Rejected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Propose Revaluation Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-600" />
                Propose Standard Rate/Revaluation
              </h3>
              <button onClick={() => setShowProposeModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePropose} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Item</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                  required
                >
                  <option value="">-- Choose Item / Component --</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} (SKU: {i.sku}) - Current Std rate: {formatCurrency(i.standard_rate || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">New Unit Cost (INR)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                  placeholder="e.g. 150.0000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Justification Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                  placeholder="Provide justification for standard rate adjustment..."
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-150 rounded-xl p-4 flex gap-3 text-xs text-blue-800">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Workflow Information</p>
                  <p className="mt-1 leading-normal">
                    Rate updates affect all remaining open cost layers and warehouse stock valuation metrics.
                    Once approved, G/L Adjustments are auto-posted between Account 1200 and Account 5000.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition duration-150 shadow-sm"
                >
                  {submitting ? 'Submitting...' : 'Draft Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
