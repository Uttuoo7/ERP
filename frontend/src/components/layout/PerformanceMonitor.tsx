import React, { useState, useEffect } from 'react';
import { usePerformanceStore } from '../../store/performanceStore';
import type { PerformanceMetric } from '../../store/performanceStore';
import { useWorkspaceTabsStore } from '../../store/workspaceTabsStore';
import { Activity, ShieldAlert, CheckCircle, Gauge, Cpu, Settings } from 'lucide-react';

export function PerformanceMonitor() {
  const { metrics } = usePerformanceStore();
  const { maxCacheSize, suspendTimeout, tabs, cachedTabIds, setCacheLimit, setSuspendTimeout, activeTabId } = useWorkspaceTabsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [memoryInfo, setMemoryInfo] = useState<{ usedJSHeapSize?: number; jsHeapSizeLimit?: number } | null>(null);

  // Poll memory metrics if supported by browser (e.g., V8 engine Chrome)
  useEffect(() => {
    const interval = setInterval(() => {
      const perf = window.performance as any;
      if (perf && perf.memory) {
        setMemoryInfo({
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
        });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Show only in local development or demo switch environment
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocal) return null;

  // Threshold configurations
  const TARGETS: Record<PerformanceMetric['category'], number> = {
    initial_load: 2000,
    module_switch: 150,
    mega_menu_open: 100,
    ribbon_switch: 50,
    tab_switch: 50,
    search: 100,
    render: 16
  };

  const getMetricStatus = (metric: PerformanceMetric) => {
    const limit = TARGETS[metric.category] || 100;
    return metric.duration <= limit ? 'pass' : 'fail';
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed bottom-9 right-4 z-[9999] font-sans text-slate-800">
      {/* Collapsed HUD Trigger */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 p-2 px-3 bg-slate-900/90 text-emerald-400 border border-slate-700 rounded-xl hover:bg-slate-900 transition shadow-xl"
          title="Open Performance Telemetry HUD"
        >
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-wider">Perf HUD</span>
        </button>
      ) : (
        /* Expanded HUD Panel */
        <div className="w-[300px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <Gauge className="w-4 h-4" /> Telemetry Monitor
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[9px] font-black uppercase border border-slate-700 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-400"
            >
              Hide
            </button>
          </div>

          {/* Memory Heap info */}
          {memoryInfo && (
            <div className="flex items-center justify-between text-[10px] bg-slate-800/50 p-2 rounded-xl border border-slate-800/80">
              <span className="flex items-center gap-1.5 font-bold text-slate-400">
                <Cpu className="w-3.5 h-3.5 text-slate-400" /> Active JS Heap
              </span>
              <span className="font-extrabold text-blue-400">{formatBytes(memoryInfo.usedJSHeapSize)}</span>
            </div>
          )}

          {/* Workspace Lifecycle Config */}
          <div className="space-y-2 bg-slate-800/30 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Settings className="w-3 h-3 text-slate-400" /> Cache & Suspend Settings
            </span>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Max Cache Size:</label>
                <input
                  type="number"
                  value={maxCacheSize}
                  min={1}
                  max={50}
                  onChange={(e) => setCacheLimit(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-blue-400 font-extrabold outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 font-bold block mb-1">Timeout (sec):</label>
                <input
                  type="number"
                  value={suspendTimeout}
                  min={5}
                  max={3600}
                  onChange={(e) => setSuspendTimeout(parseInt(e.target.value) || 300)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-blue-400 font-extrabold outline-none"
                />
              </div>
            </div>
            <div className="text-[8px] text-slate-400 font-semibold leading-tight pt-1">
              Active: {activeTabId ? 1 : 0} | Cached: {Math.max(0, cachedTabIds.length - (activeTabId ? 1 : 0))} | Suspended: {tabs.length - cachedTabIds.length}
            </div>
          </div>

          {/* Latency Thresholds list */}
          <div className="space-y-1.5">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">
              SLA Limits vs Real-time metrics
            </span>
            <div className="flex flex-col gap-1 text-[9px]">
              {Object.entries(TARGETS).map(([cat, threshold]) => {
                // Find most recent metric in this category
                const match = metrics.find(m => m.category === cat);
                return (
                  <div key={cat} className="flex justify-between items-center py-0.5 border-b border-slate-800/30">
                    <span className="font-bold text-slate-400 capitalize">{cat.replace('_', ' ')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">({threshold}ms)</span>
                      {match ? (
                        <span className={`font-extrabold flex items-center gap-0.5 ${
                          getMetricStatus(match) === 'pass' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {match.duration}ms
                          {getMetricStatus(match) === 'pass' ? (
                            <CheckCircle className="w-2.5 h-2.5" />
                          ) : (
                            <ShieldAlert className="w-2.5 h-2.5" />
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-semibold">--</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Operations log */}
          <div className="space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800 max-h-[100px] overflow-y-auto">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">
              Operation Logs
            </span>
            {metrics.length === 0 ? (
              <span className="text-[9px] text-slate-600 font-semibold italic">No records capture yet.</span>
            ) : (
              metrics.slice(0, 5).map((m) => (
                <div key={m.id} className="flex justify-between items-center text-[8px] py-0.5 border-b border-slate-900">
                  <span className="text-slate-400 font-bold truncate max-w-[170px]">{m.action}</span>
                  <span className={getMetricStatus(m) === 'pass' ? 'text-emerald-400' : 'text-rose-400'}>
                    {m.duration}ms
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
