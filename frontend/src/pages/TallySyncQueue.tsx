import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Layers, CheckCircle, AlertCircle, FileText, ArrowRight, Loader2, Sparkles, Send, Copy, FileCode
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getTallySyncQueue, syncAllTally } from '../api';

const TallySyncQueue: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await getTallySyncQueue({
        sync_status: statusFilter || undefined
      });
      setSyncQueue(res.data);
      if (res.data.length > 0 && !selectedItem) {
        setSelectedItem(res.data[0]);
      }
    } catch (err) {
      toast.error("Failed to load Tally Sync queue monitoring details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await syncAllTally();
      toast.success(`Tally synchronization triggered: Synced: ${res.data.synced} | Failed: ${res.data.failed}.`);
      fetchQueue();
    } catch (err) {
      toast.error("Failed to push sync task to TallyPrime local gateway.");
    } finally {
      setSyncingAll(false);
    }
  };

  const copyToClipboard = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Tally Prime Gateway XML copied to clipboard.");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">TallyPrime integration synchronization console</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Simulated ERP to Tally synchronization pipeline, voucher mappings, and raw XML Gateway payloads</p>
        </div>

        <button
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
        >
          {syncingAll ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <RefreshCw className="w-4.5 h-4.5" />}
          Trigger Tally Sync All
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Sync Queue list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Sync Tasks</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg outline-none bg-white font-semibold text-slate-600"
            >
              <option value="">-- All Queue --</option>
              <option value="PENDING">Pending Sync</option>
              <option value="SYNCED">Synced Accounts</option>
              <option value="FAILED">Failed Items</option>
            </select>
          </div>

          {loading && syncQueue.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Reading integration queue...</p>
          ) : syncQueue.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No active Tally synchronization logs found.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {syncQueue.map(item => {
                const isSelected = selectedItem?.id === item.id;
                const statusColors = 
                  item.sync_status === 'SYNCED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  item.sync_status === 'FAILED' ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse' :
                  'bg-amber-50 text-amber-700 border-amber-100 animate-pulse';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 text-xs ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50/20 shadow-sm' 
                        : 'border-slate-150 bg-white hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-slate-900">Voucher: {item.financial_transaction?.transaction_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black border ${statusColors}`}>
                        {item.sync_status}
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-450 font-semibold">
                      <span>Type: {item.financial_transaction?.transaction_type}</span>
                      <span>Total: ₹{parseFloat(item.financial_transaction?.total_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: XML inspector & details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedItem ? (
            <>
              {/* Header metrics card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">INTEGRATION SYNC TASK ID</span>
                    <h3 className="text-sm font-extrabold text-slate-900">{selectedItem.id}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                    selectedItem.sync_status === 'SYNCED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    Sync State: {selectedItem.sync_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-500 border-t border-slate-50 pt-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Retry Attempts</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedItem.retry_count} / 3</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Last Attempt Date</span>
                    <span className="text-slate-800 font-bold block mt-0.5">
                      {selectedItem.last_attempt_at ? new Date(selectedItem.last_attempt_at).toLocaleString() : 'Never Attempted'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Sync Completed Date</span>
                    <span className="text-slate-800 font-bold block mt-0.5">
                      {selectedItem.synced_at ? new Date(selectedItem.synced_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Associated Voucher</span>
                    <span className="text-blue-600 font-black block mt-0.5">{selectedItem.financial_transaction?.transaction_number}</span>
                  </div>
                </div>

                {selectedItem.error_message && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-semibold leading-relaxed">
                    <span className="font-extrabold block">Synchronization Error Logs</span>
                    <span>{selectedItem.error_message}</span>
                  </div>
                )}
              </div>

              {/* Raw Tally XML Payload Inspector */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <FileCode className="w-4.5 h-4.5 text-blue-600" /> TallyPrime Gateway XML Voucher
                  </h3>
                  <button
                    onClick={() => copyToClipboard(selectedItem.payload_xml)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100/60 transition-all border border-blue-100"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Payload XML
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-[350px]">
                    <code>{selectedItem.payload_xml}</code>
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center">
              <FileCode className="w-12 h-12 text-slate-350 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Select Synchronization Task</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Choose an integration item on the left sync queue list to inspect Tally's ledger payload mapping XML schemas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TallySyncQueue;
