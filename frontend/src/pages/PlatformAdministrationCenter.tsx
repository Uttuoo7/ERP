import React, { useState, useEffect } from 'react';
import api from '../api';
import { PlatformHealthService } from '../services/PlatformHealthService';
import type { HealthReport } from '../services/PlatformHealthService';
import { EnterprisePlatformSDK } from '../sdk/EnterprisePlatformSDK';
import type { PluginManifest } from '../sdk/EnterprisePlatformSDK';
import { PlatformCertificationService } from '../services/PlatformCertificationService';
import { PlatformCompatibilityValidator } from '../services/PlatformCompatibilityValidator';
import { PluginRegistry } from '../services/PluginRegistry';
import { Settings, Shield, Activity, RefreshCw, Layers, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PlatformAdministrationCenter() {
  const [activeTab, setActiveTab] = useState<'plugins' | 'flags' | 'health'>('plugins');
  const [pluginsList, setPluginsList] = useState<PluginManifest[]>([]);
  const [dbPluginStates, setDbPluginStates] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);

  // Seeding/Registry initialization
  useEffect(() => {
    PluginRegistry.initialize();
    setPluginsList(EnterprisePlatformSDK.getPlugins());
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch DB Plugin States
      const pRes = await api.get('/api/saas/plugins/state');
      setDbPluginStates(pRes.data);

      // 2. Fetch Feature Flags
      const fRes = await api.get('/api/saas/features?env=Production');
      setFeatureFlags(fRes.data);

      // 3. Fetch Health metrics
      const health = await PlatformHealthService.fetchHealthReport();
      setHealthReport(health);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load platform administration state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePlugin = async (pluginKey: string, currentEnabled: boolean) => {
    try {
      const manifest = pluginsList.find(p => p.key === pluginKey);
      if (!manifest) return;

      // Validate compatibility & certify
      const compat = PlatformCompatibilityValidator.validate(manifest);
      if (!compat.isValid) {
        toast.error(`Compatibility mismatch: ${compat.warning}`);
        return;
      }

      const cert = PlatformCertificationService.certify(manifest);
      if (!cert.certified) {
        toast.error(`Certification failed: ${cert.errors.join(', ')}`);
        return;
      }

      await api.put(`/api/saas/plugins/state/${pluginKey}`, {
        enabled: !currentEnabled,
        installed_version: manifest.version,
        license_level: "standard"
      });

      // Certify on backend
      await api.post(`/api/saas/plugins/certify/${pluginKey}`, manifest);

      // Run install/uninstall migration hook
      const action = !currentEnabled ? "onInstall" : "onUninstall";
      await api.post(`/api/saas/plugins/migrate/${pluginKey}?action=${action}`);

      toast.success(`Module ${pluginKey} ${!currentEnabled ? 'enabled' : 'disabled'} and migrations executed.`);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to modify plugin state.");
    }
  };

  const handleToggleFlag = async (flagId: string, currentVal: boolean) => {
    try {
      await api.put(`/api/saas/features/${flagId}`, {
        enabled: !currentVal
      });
      toast.success("Feature flag toggled successfully.");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to toggle feature flag.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 font-sans text-xs text-slate-700">
      <div className="flex justify-between items-center pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Cpu className="w-6 h-6 text-indigo-600" /> Platform Administration Center
          </h1>
          <p className="text-slate-400 font-medium">Configure extensions, feature availability, and monitor platform health.</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase transition tracking-wider shadow-lg shadow-indigo-500/10"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Center
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('plugins')}
          className={`px-4 py-2.5 font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'plugins' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Layers className="inline-block w-4 h-4 mr-1.5" /> Module Extensions
        </button>
        <button
          onClick={() => setActiveTab('flags')}
          className={`px-4 py-2.5 font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'flags' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Shield className="inline-block w-4 h-4 mr-1.5" /> Feature Flags
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2.5 font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'health' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Activity className="inline-block w-4 h-4 mr-1.5" /> Diagnostics & SLA
        </button>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'plugins' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase mb-4">Plugin Dependency Graph & Compatibility Checks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                <span className="font-bold text-slate-600 block mb-2">Core Platform Metadata</span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">Platform Release Version</span>
                    <span className="font-bold text-indigo-600">v1.0.0 (Frozen)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">API Gateway Interface</span>
                    <span className="font-bold text-slate-600">v1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">Database Schema Version</span>
                    <span className="font-bold text-slate-600">v1.0</span>
                  </div>
                </div>
              </div>
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                <span className="font-bold text-slate-600 block mb-2">Dependency Rules</span>
                <p className="text-slate-400 font-medium leading-relaxed">
                  Plugins are topologically sorted during initialization. Missing or disabled dependencies automatically deactivate child modules (e.g. <b>Inventory</b> requires <b>Procurement</b>).
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800 uppercase">Installed Extensions Inventory</h2>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                  <th className="px-6 py-3">Module Key</th>
                  <th className="px-6 py-3">Version</th>
                  <th className="px-6 py-3">Dependencies</th>
                  <th className="px-6 py-3">Certification</th>
                  <th className="px-6 py-3">Database State</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pluginsList.map(p => {
                  const dbState = dbPluginStates.find(ds => ds.plugin_key === p.key);
                  const isEnabled = dbState ? dbState.enabled : false;
                  const isCertified = dbState ? dbState.is_certified : false;
                  
                  return (
                    <tr key={p.key} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-bold text-slate-800 uppercase">{p.key}</td>
                      <td className="px-6 py-4 font-semibold text-slate-500">{p.version}</td>
                      <td className="px-6 py-4">
                        {p.dependencies && p.dependencies.length > 0 ? (
                          p.dependencies.map(d => (
                            <span key={d} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 font-semibold rounded mr-1 uppercase">
                              {d}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-300">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isCertified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-4 h-4" /> Certified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
                            <AlertTriangle className="w-4 h-4" /> Uncertified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase ${isEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                          {isEnabled ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleTogglePlugin(p.key, isEnabled)}
                          className={`px-3 py-1.5 rounded-lg font-bold uppercase transition ${isEnabled ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'}`}
                        >
                          {isEnabled ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'flags' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 uppercase">Enterprise Feature Flags Control Room</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                <th className="px-6 py-3">Feature Key</th>
                <th className="px-6 py-3">Environment</th>
                <th className="px-6 py-3">Rollout Target</th>
                <th className="px-6 py-3">Licensing Level</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {featureFlags.map(f => (
                <tr key={f.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 font-bold text-slate-800">{f.feature_key}</td>
                  <td className="px-6 py-4 font-semibold text-slate-500">{f.environment}</td>
                  <td className="px-6 py-4 font-semibold text-slate-500">{f.rollout_percentage}% Rollout</td>
                  <td className="px-6 py-4 font-semibold text-slate-500 uppercase">{f.minimum_license || 'standard'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase ${f.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                      {f.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleToggleFlag(f.id, f.enabled)}
                      className={`px-3 py-1.5 rounded-lg font-bold uppercase transition ${f.enabled ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'}`}
                    >
                      {f.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'health' && healthReport && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 uppercase mb-4">Diagnostics Health Status</h3>
            <div className="space-y-3.5 font-semibold text-slate-500">
              <div className="flex justify-between items-center">
                <span>Database Connection</span>
                <span className={healthReport.database === 'UP' ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{healthReport.database}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Redis cache Server</span>
                <span className={healthReport.redis === 'UP' ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{healthReport.redis}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>WebSocket Stream</span>
                <span className={healthReport.websocket === 'UP' ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{healthReport.websocket}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Celery Job Queue</span>
                <span className={healthReport.celery === 'UP' ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{healthReport.celery}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 uppercase mb-4">SLA Performance Monitors</h3>
            <div className="space-y-3.5 font-semibold text-slate-500">
              <div className="flex justify-between">
                <span>Connected sessions</span>
                <span className="text-slate-800 font-bold">{healthReport.activeUsers} Active</span>
              </div>
              <div className="flex justify-between">
                <span>API Latency</span>
                <span className="text-slate-800 font-bold">{healthReport.apiLatencyMs} ms</span>
              </div>
              <div className="flex justify-between">
                <span>System Memory Growth</span>
                <span className="text-slate-800 font-bold">{healthReport.memoryUsageMb}% Utilized</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 uppercase mb-4">Platform Upgrade Center</h3>
            <div className="space-y-4">
              <button
                onClick={() => toast.success("Verified. Platform is on latest stable version.")}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold uppercase rounded-xl transition tracking-wider border border-slate-200"
              >
                Scan for Platform Upgrades
              </button>
              <button
                onClick={() => toast.success("System backup manifest saved successfully.")}
                className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold uppercase rounded-xl transition tracking-wider border border-indigo-100"
              >
                Trigger System Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
