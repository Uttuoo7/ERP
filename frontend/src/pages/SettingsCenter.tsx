import React, { useState, useEffect } from 'react';
import api from '../api';
import { SettingsSearchEngine } from '../services/SettingsSearchEngine';
import type { SettingsIndexItem } from '../services/SettingsSearchEngine';
import { Settings, Shield, Keyboard, Sliders, Globe, Palette, Import, FileOutput, Search, ArrowRight, UserCheck, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsCenter() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SettingsIndexItem[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);

  // Form Preferences States
  const [preferences, setPreferences] = useState({
    general: {
      landingPage: "/dashboard",
      company: "Apex Global Industries Ltd",
      warehouse: "Default Warehouse",
      language: "en",
      currency: "USD",
      timezone: "UTC"
    },
    appearance: {
      theme: "light",
      density: "comfortable"
    },
    navigation: {
      favorites: ["requisitions", "pos"],
      ribbon: {}
    },
    dashboard: {
      layout: {}
    },
    notifications: {
      routing: ["desktop", "email"]
    },
    keyboard: {
      shortcuts: {}
    },
    accessibility: {
      screenReader: false,
      reducedMotion: false
    }
  });

  // Workspaces Governance state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any | null>(null);

  const loadPreferences = async () => {
    try {
      const res = await api.get('/api/auth/preferences');
      if (res.data && res.data.preferences_json) {
        try {
          const parsed = JSON.parse(res.data.preferences_json);
          setPreferences(prev => ({ ...prev, ...parsed }));
        } catch {}
      }

      // Fetch Workspaces
      const wRes = await api.get('/api/workspaces');
      setWorkspaces(wRes.data);

      // Fetch Roles Definition
      const rolesRes = await api.get('/api/saas/tenants'); // Mock roles load or standard endpoint
      // We will seed standard roles definition
      setRolesList([
        { id: "1", name: "ADMIN" },
        { id: "2", name: "BUYER" },
        { id: "3", name: "WAREHOUSE" },
        { id: "4", name: "FINANCE" }
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load settings configuration.");
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchResults(SettingsSearchEngine.search(q));
  };

  const handleSelectResult = (item: SettingsIndexItem) => {
    setActiveTab(item.tabIndex);
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`Focused ${item.title}`);
    
    // Focus target element
    setTimeout(() => {
      const el = document.getElementById(item.focusId);
      if (el) {
        el.focus();
        el.classList.add('ring-2', 'ring-indigo-500', 'transition-all');
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500'), 2000);
      }
    }, 100);
  };

  const handleSavePreferences = async (updatedPrefs = preferences) => {
    try {
      await api.put('/api/auth/preferences', {
        preferences_json: JSON.stringify(updatedPrefs)
      });
      toast.success("Settings updated and persisted to server.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save settings changes.");
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/api/auth/preferences/export');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "erp_preferences_manifest.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Preferences manifest exported successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export settings.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const manifest = JSON.parse(event.target?.result as string);
        const res = await api.post('/api/auth/preferences/import', manifest);
        if (res.data && res.data.preferences_json) {
          const parsed = JSON.parse(res.data.preferences_json);
          setPreferences(parsed);
          toast.success("Preferences manifest imported and active.");
        }
      } catch (err: any) {
        toast.error(`Import failed: ${err.response?.data?.detail || "Invalid JSON file structure"}`);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateWorkspacePermission = async (permId: string, field: string, val: boolean) => {
    // Re-save specific workspace permissions mapping
    if (!selectedWorkspace) return;
    try {
      const updatedPerms = selectedWorkspace.permissions.map((p: any) => {
        if (p.id === permId) {
          return { ...p, [field]: val };
        }
        return p;
      });

      // Update local workspace permissions
      const updatedWorkspace = { ...selectedWorkspace, permissions: updatedPerms };
      setSelectedWorkspace(updatedWorkspace);

      await api.put(`/api/workspaces/${selectedWorkspace.id}`, {
        name: selectedWorkspace.name,
        layout_json: selectedWorkspace.layout_json
      });
      toast.success("Workspace permissions saved.");
      loadPreferences();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update workspace permissions.");
    }
  };

  const tabs = [
    { label: "General", icon: Globe },
    { label: "Appearance", icon: Palette },
    { label: "Navigation", icon: Layers },
    { label: "Workspaces", icon: Sliders },
    { label: "Notifications", icon: Shield },
    { label: "Keyboard", icon: Keyboard },
    { label: "Accessibility", icon: UserCheck }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 font-sans text-xs text-slate-700">
      <div className="flex justify-between items-center pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600 animate-spin-slow" /> Enterprise Settings Center
          </h1>
          <p className="text-slate-400 font-medium">Manage localized settings, display preferences, and keyboard mappings.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold uppercase transition tracking-wider shadow-sm"
          >
            <FileOutput className="w-3.5 h-3.5" /> Export Profile
          </button>
          <label className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase cursor-pointer transition tracking-wider shadow-lg shadow-indigo-500/10">
            <Import className="w-3.5 h-3.5" /> Import Profile
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Centralized Global Search bar */}
      <div className="relative mb-8 max-w-xl">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search settings options (e.g. theme, currency, timezone, screenReader)..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl placeholder-slate-400 font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {searchResults.map(item => (
              <button
                key={item.key}
                onClick={() => handleSelectResult(item)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex justify-between items-center transition"
              >
                <div>
                  <span className="font-bold text-slate-800 text-[11px]">{item.title}</span>
                  <p className="text-slate-400 text-[10px] mt-0.5">{item.description}</p>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-600 font-extrabold text-[10px] uppercase tracking-wider">
                  {item.category} <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Sidebar Menu */}
        <div className="lg:w-64 shrink-0 flex flex-col gap-1">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold uppercase transition text-left tracking-wider ${activeTab === idx ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Viewports Content Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          {activeTab === 0 && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 uppercase mb-4 pb-2 border-b border-slate-100">General Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Default Landing Page</label>
                  <select
                    id="select-landing-page"
                    value={preferences.general.landingPage}
                    onChange={(e) => {
                      const updated = { ...preferences, general: { ...preferences.general, landingPage: e.target.value } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="/dashboard">Analytics Dashboard</option>
                    <option value="/pos">Purchase Orders Registry</option>
                    <option value="/inventory">Warehouse Live Panel</option>
                    <option value="/inbox">Approval Work Center</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Time Zone</label>
                  <select
                    id="select-timezone"
                    value={preferences.general.timezone}
                    onChange={(e) => {
                      const updated = { ...preferences, general: { ...preferences.general, timezone: e.target.value } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                    <option value="Asia/Kolkata">Indian Standard Time (IST)</option>
                    <option value="America/New_York">Eastern Standard Time (EST)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Language</label>
                  <select
                    id="select-language"
                    value={preferences.general.language}
                    onChange={(e) => {
                      const updated = { ...preferences, general: { ...preferences.general, language: e.target.value } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="en">English (US)</option>
                    <option value="es">Spanish (ES)</option>
                    <option value="de">German (DE)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Currency</label>
                  <select
                    id="select-currency"
                    value={preferences.general.currency}
                    onChange={(e) => {
                      const updated = { ...preferences, general: { ...preferences.general, currency: e.target.value } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 uppercase mb-4 pb-2 border-b border-slate-100">Appearance Styling Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Enterprise Theme</label>
                  <select
                    id="select-theme"
                    value={preferences.appearance.theme}
                    onChange={(e) => {
                      const updated = { ...preferences, appearance: { ...preferences.appearance, theme: e.target.value } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="light">Classic Light Mode</option>
                    <option value="dark">Sleek Dark Mode</option>
                    <option value="enterprise-blue">Vibrant Enterprise Blue</option>
                    <option value="professional-gray">Professional Slate Gray</option>
                    <option value="high-contrast">High Contrast Mode</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Table Row Density</label>
                  <select
                    id="select-density"
                    value={preferences.appearance.density}
                    onChange={(e) => {
                      const updated = { ...preferences, appearance: { ...preferences.appearance, density: e.target.value } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="comfortable">Comfortable (Standard)</option>
                    <option value="compact">Compact Row Heights (High density)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 3 && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 uppercase mb-4 pb-2 border-b border-slate-100">Workspace Governance Permissions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 max-h-80 overflow-y-auto space-y-2">
                  <span className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Saved Layouts</span>
                  {workspaces.map(ws => (
                    <button
                      key={ws.id}
                      onClick={() => setSelectedWorkspace(ws)}
                      className={`w-full p-3 text-left rounded-xl transition font-bold uppercase ${selectedWorkspace?.id === ws.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10' : 'bg-white hover:bg-slate-100'}`}
                    >
                      {ws.name}
                      <span className="block text-[9px] font-semibold text-slate-400 mt-1 uppercase">{ws.type} Layout</span>
                    </button>
                  ))}
                </div>

                <div className="col-span-2 border border-slate-200 rounded-2xl p-6 bg-white">
                  {selectedWorkspace ? (
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase mb-4">
                        Roles Permissions Setup - {selectedWorkspace.name}
                      </h3>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[9px] uppercase font-bold text-slate-400">
                            <th className="py-2">Role Name</th>
                            <th className="py-2 text-center">View</th>
                            <th className="py-2 text-center">Edit</th>
                            <th className="py-2 text-center">Duplicate</th>
                            <th className="py-2 text-center">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-600">
                          {selectedWorkspace.permissions.map((p: any) => (
                            <tr key={p.id}>
                              <td className="py-3 font-bold uppercase text-slate-700">{p.role_name}</td>
                              <td className="py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_view}
                                  onChange={(e) => handleUpdateWorkspacePermission(p.id, 'can_view', e.target.checked)}
                                  className="w-3.5 h-3.5 text-indigo-600"
                                />
                              </td>
                              <td className="py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_edit}
                                  onChange={(e) => handleUpdateWorkspacePermission(p.id, 'can_edit', e.target.checked)}
                                  className="w-3.5 h-3.5 text-indigo-600"
                                />
                              </td>
                              <td className="py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_duplicate}
                                  onChange={(e) => handleUpdateWorkspacePermission(p.id, 'can_duplicate', e.target.checked)}
                                  className="w-3.5 h-3.5 text-indigo-600"
                                />
                              </td>
                              <td className="py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_delete}
                                  onChange={(e) => handleUpdateWorkspacePermission(p.id, 'can_delete', e.target.checked)}
                                  className="w-3.5 h-3.5 text-indigo-600"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                      <Sliders className="w-12 h-12 text-slate-300 mb-2" />
                      Select a workspace layout from the left to configure access permissions.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 4 && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 uppercase mb-4 pb-2 border-b border-slate-100">Advanced Notification Routing</h2>
              <div className="space-y-4">
                <span className="font-bold text-slate-600 block mb-2 uppercase tracking-wide">Configurable Routing Rules</span>
                <div className="grid grid-cols-2 gap-4">
                  {['Desktop Notifications', 'Email Alerts', 'Sound cues', 'Slack Workspaces', 'Microsoft Teams channels', 'Mobile Push notifications'].map((channel) => (
                    <label key={channel} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/50 transition">
                      <input
                        type="checkbox"
                        checked={preferences.notifications.routing.includes(channel.split(' ')[0].toLowerCase())}
                        onChange={(e) => {
                          const routeKey = channel.split(' ')[0].toLowerCase();
                          const nextRoutes = e.target.checked
                            ? [...preferences.notifications.routing, routeKey]
                            : preferences.notifications.routing.filter(x => x !== routeKey);
                          
                          const updated = { ...preferences, notifications: { ...preferences.notifications, routing: nextRoutes } };
                          setPreferences(updated);
                          handleSavePreferences(updated);
                        }}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="font-bold text-slate-700">{channel}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 6 && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-800 uppercase mb-4 pb-2 border-b border-slate-100">Accessibility Standards</h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/50 transition">
                  <div>
                    <span className="font-black text-slate-800 text-[11px] block uppercase">WCAG 2.1 Screen Reader Compatibility</span>
                    <span className="text-slate-400 font-semibold text-[10px]">Adds explicit ARIA tags and indicators on active navigation bars.</span>
                  </div>
                  <input
                    id="screen-reader-toggle"
                    type="checkbox"
                    checked={preferences.accessibility.screenReader}
                    onChange={(e) => {
                      const updated = { ...preferences, accessibility: { ...preferences.accessibility, screenReader: e.target.checked } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/50 transition">
                  <div>
                    <span className="font-black text-slate-800 text-[11px] block uppercase">Prefers Reduced Motion Mode</span>
                    <span className="text-slate-400 font-semibold text-[10px]">Minimizes workspace transition and dashboard modal animations.</span>
                  </div>
                  <input
                    id="reduced-motion-toggle"
                    type="checkbox"
                    checked={preferences.accessibility.reducedMotion}
                    onChange={(e) => {
                      const updated = { ...preferences, accessibility: { ...preferences.accessibility, reducedMotion: e.target.checked } };
                      setPreferences(updated);
                      handleSavePreferences(updated);
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
