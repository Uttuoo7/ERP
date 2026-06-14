import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Plus, 
  Calendar, 
  Warehouse, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  ArrowLeft, 
  Undo2,
  Trash2,
  CheckCircle,
  Eye,
  FileText,
  DollarSign
} from 'lucide-react';
import api, { getWarehouses } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface WarehouseData {
  id: string;
  name: string;
  warehouse_code: string;
}

interface Snapshot {
  id: string;
  snapshot_date: string;
  warehouse_id?: string | null;
  inventory_value: number;
  inventory_quantity: number;
  item_count: number;
  created_at: string;
}

interface SnapshotItemDetail {
  item_id: string;
  sku: string;
  name: string;
  category: string;
  quantity_on_hand: number;
  unit_cost: number;
  inventory_value: number;
}

export default function InventorySnapshots() {
  const user = useAuthStore(state => state.user);
  const userRole = user?.role || 'EMPLOYEE';
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Selected Snapshot & Drill-down State
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [snapshotDetails, setSnapshotDetails] = useState<SnapshotItemDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [detailSearch, setDetailSearch] = useState<string>('');

  // New Snapshot Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [snapshotDate, setSnapshotDate] = useState<string>(
    new Date().toISOString().substring(0, 16)
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Restore Modal State
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [snapshotsRes, warehousesRes] = await Promise.all([
        api.get('/inventory/snapshots'),
        getWarehouses()
      ]);
      setSnapshots(snapshotsRes.data);
      setWarehouses(warehousesRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to retrieve inventory snapshots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        snapshot_date: new Date(snapshotDate).toISOString(),
        warehouse_id: selectedWarehouseId === 'all' ? null : selectedWarehouseId
      };
      await api.post('/inventory/snapshots', payload);
      toast.success('Inventory snapshot compiled and saved successfully.');
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    setLoadingDetails(true);
    setDetailSearch('');
    try {
      const res = await api.get(`/inventory/snapshots/${snapshot.id}/details`);
      setSnapshotDetails(res.data.details);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load item snapshot details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedSnapshot) return;
    setRestoring(true);
    try {
      const res = await api.post(`/inventory/snapshots/${selectedSnapshot.id}/restore`);
      if (res.data.status === 'success') {
        toast.success('Inventory state restored successfully.');
        setShowRestoreConfirm(false);
        setSelectedSnapshot(null);
        fetchData();
      } else {
        toast.error(res.data.message || 'Restoration failed.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRestoring(false);
    }
  };

  const getWarehouseName = (warehouseId?: string | null) => {
    if (!warehouseId) return 'All Warehouses';
    const wh = warehouses.find(w => w.id === warehouseId);
    return wh ? wh.name : 'Unknown Warehouse';
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val);
  };

  const filteredDetails = snapshotDetails.filter(item => {
    return (
      item.name.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(detailSearch.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* Detail Drill-down View */}
      {selectedSnapshot ? (
        <div className="space-y-6 animate-in slide-in-from-right duration-250">
          
          {/* Detail Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <button 
                onClick={() => setSelectedSnapshot(null)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-semibold mb-2 transition duration-150"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Snapshots
              </button>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
                <Camera className="w-7 h-7 text-blue-600" />
                Snapshot: {new Date(selectedSnapshot.snapshot_date).toLocaleString()}
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Scoped to: <span className="font-semibold text-slate-700">{getWarehouseName(selectedSnapshot.warehouse_id)}</span> | Generated: {new Date(selectedSnapshot.created_at).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-rose-100 transition duration-200"
                >
                  <Undo2 className="w-4 h-4" />
                  Restore Ledger State
                </button>
              )}
            </div>
          </div>

          {/* Drill-down Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Item Count</span>
              <div className="text-3xl font-black mt-2 text-slate-900">{selectedSnapshot.item_count}</div>
              <p className="text-xs text-slate-400 mt-2">Unique catalog codes tracked in this run</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Historical Quantity</span>
              <div className="text-3xl font-black mt-2 text-slate-900">{Number(selectedSnapshot.inventory_quantity).toLocaleString()}</div>
              <p className="text-xs text-slate-400 mt-2">Aggregate units on hand at snapshot timestamp</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl shadow-md p-6 border border-slate-800">
              <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider">Historical Value</span>
              <div className="text-3xl font-black mt-2 tracking-tight text-white">{formatCurrency(selectedSnapshot.inventory_value)}</div>
              <p className="text-xs text-slate-400 mt-2">Valued according to active cost method at that time</p>
            </div>
          </div>

          {/* Details Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-lg font-bold text-slate-900">Items Inventory State</h2>
              
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder="Search SKU, name, category..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl text-sm transition duration-150"
                />
              </div>
            </div>

            {loadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-slate-500 text-sm">Compiling item breakdown...</p>
              </div>
            ) : filteredDetails.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                No items match search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold">SKU</th>
                      <th className="px-6 py-3 font-semibold">Item Name</th>
                      <th className="px-6 py-3 font-semibold">Category</th>
                      <th className="px-6 py-3 font-semibold text-right">Qty On Hand</th>
                      <th className="px-6 py-3 font-semibold text-right">Unit cost</th>
                      <th className="px-6 py-3 font-semibold text-right">Inventory Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetails.map((item, idx) => (
                      <tr key={idx} className="bg-white border-b border-slate-150 hover:bg-slate-50/50 transition duration-150">
                        <td className="px-6 py-4 font-semibold text-slate-900 font-mono">{item.sku}</td>
                        <td className="px-6 py-4 text-slate-900 font-medium">{item.name}</td>
                        <td className="px-6 py-4 text-xs font-semibold text-blue-700 bg-blue-50/50 rounded-lg inline-block my-2.5 ml-6">
                          {item.category}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-950">
                          {Number(item.quantity_on_hand).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                          {formatCurrency(item.unit_cost)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold font-mono text-slate-950">
                          {formatCurrency(item.inventory_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Restore Confirmation Modal */}
          {showRestoreConfirm && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
                <div className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-950">Irreversible Action: Restore Inventory</h3>
                    <p className="text-sm text-slate-500 leading-normal">
                      Are you sure you want to restore the subledger to <span className="font-semibold text-slate-900">{new Date(selectedSnapshot.snapshot_date).toLocaleString()}</span>?
                    </p>
                    <p className="text-xs bg-rose-50 text-rose-800 p-3 rounded-xl leading-normal border border-rose-100 font-medium text-left">
                      WARNING: This action deactivates all cost layers created after the snapshot, deletes transaction/valuation records beyond the snapshot date, and recalculates stock levels. This cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 p-4 bg-slate-50 border-t border-slate-150">
                  <button
                    onClick={() => setShowRestoreConfirm(false)}
                    disabled={restoring}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={restoring}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition duration-150 shadow-sm"
                  >
                    {restoring ? 'Restoring state...' : 'Yes, Revert Subledger'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Main Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                <Camera className="w-8 h-8 text-blue-600" />
                Inventory Audit Snapshots
              </h1>
              <p className="text-slate-500 mt-1">
                Generate month-end or period-close subledger baselines, view item states, and execute rollbacks.
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
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-blue-100 transition duration-200"
              >
                <Plus className="w-4 h-4" />
                Compile Snapshot
              </button>
            </div>
          </div>

          {/* Snapshots Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Historical Baselines</h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {snapshots.length} runs compiled
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-slate-500 text-sm">Loading snapshotted indices...</p>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-20">
                <Camera className="w-12 h-12 text-slate-350 mx-auto stroke-[1.5]" />
                <p className="text-slate-500 font-medium mt-4">No snapshots generated yet.</p>
                <p className="text-slate-400 text-sm mt-1">Compile inventory subledger records at any past date for compliance or audit analysis.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Snapshot Date & Time</th>
                      <th className="px-6 py-3 font-semibold">Warehouse Scope</th>
                      <th className="px-6 py-3 font-semibold text-right">Items Count</th>
                      <th className="px-6 py-3 font-semibold text-right">Total Units</th>
                      <th className="px-6 py-3 font-semibold text-right">Total Value (INR)</th>
                      <th className="px-6 py-3 font-semibold">Run Timestamp</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map(snap => (
                      <tr key={snap.id} className="bg-white border-b border-slate-150 hover:bg-slate-50/50 transition duration-150">
                        <td className="px-6 py-4 font-semibold text-slate-950">
                          {new Date(snap.snapshot_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {getWarehouseName(snap.warehouse_id)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          {snap.item_count}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          {Number(snap.inventory_quantity).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-bold font-mono text-slate-950">
                          {formatCurrency(snap.inventory_value)}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(snap.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleViewDetails(snap)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg ml-auto transition duration-150"
                          >
                            <Eye className="w-3.5 h-3.5" /> Explore Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create Snapshot Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-blue-600" />
                    Compile Valuation Snapshot
                  </h3>
                  <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateSnapshot} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Snapshot Point-in-Time Date</label>
                    <input
                      type="datetime-local"
                      value={snapshotDate}
                      onChange={(e) => setSnapshotDate(e.target.value)}
                      className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Warehouse Scope</label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border"
                    >
                      <option value="all">All Warehouses (Global Baseline)</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.warehouse_code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-blue-50 border border-blue-150 rounded-xl p-4 flex gap-3 text-xs text-blue-800">
                    <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Replay Mechanics</p>
                      <p className="mt-1 leading-normal">
                        This compilation performs date-bound back-reconstruction by replaying the inventory subledger histories up to the requested point in time. It does not affect current stock levels.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition duration-150"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition duration-150 shadow-sm"
                    >
                      {submitting ? 'Generating...' : 'Compile Baseline'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
