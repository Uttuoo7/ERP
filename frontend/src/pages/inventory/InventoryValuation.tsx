import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Settings, 
  Search, 
  RefreshCw, 
  Warehouse, 
  Layers, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import api from "../../api";
import { useAuthStore } from "../../store/authStore";
import toast from 'react-hot-toast';

interface ValuationItem {
  item_id: string;
  sku: string;
  name: string;
  quantity_on_hand: number;
  unit_cost: number;
  inventory_value: number;
  warehouse_name: string;
  category_name: string;
}

interface ValuationData {
  items: ValuationItem[];
  warehouse_totals: Record<string, number>;
  category_totals: Record<string, number>;
  company_total_value: number;
}

interface SettingsData {
  inventory_costing_method: string;
  allow_negative_inventory: boolean;
}

export default function InventoryValuation() {
  const user = useAuthStore(state => state.user);
  const userRole = user?.role || 'EMPLOYEE';
  const isAuthorizedToEdit = ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'].includes(userRole);

  const [loading, setLoading] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [valuationData, setValuationData] = useState<ValuationData>({
    items: [],
    warehouse_totals: {},
    category_totals: {},
    company_total_value: 0
  });
  
  const [settings, setSettings] = useState<SettingsData>({
    inventory_costing_method: 'FIFO',
    allow_negative_inventory: false
  });

  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [valuationRes, settingsRes] = await Promise.all([
        api.get('/inventory/valuation'),
        api.get('/inventory/settings')
      ]);
      setValuationData(valuationRes.data);
      setSettings(settingsRes.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load inventory valuation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedToEdit) return;

    setSavingSettings(true);
    try {
      await api.post('/inventory/settings', settings);
      toast.success("Inventory costing configuration updated successfully.");
      setShowSettingsModal(false);
      // Reload valuation in case costing method changed (triggers recalculation logic in later phases)
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update inventory settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  // Get unique warehouses and categories for filters
  const warehouses = Array.from(new Set(valuationData.items.map(item => item.warehouse_name).filter(Boolean)));
  const categories = Array.from(new Set(valuationData.items.map(item => item.category_name).filter(Boolean)));

  // Filter items based on search term and dropdown selections
  const filteredItems = valuationData.items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWarehouse = selectedWarehouse === 'all' || item.warehouse_name === selectedWarehouse;
    const matchesCategory = selectedCategory === 'all' || item.category_name === selectedCategory;
    return matchesSearch && matchesWarehouse && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-600" />
            Inventory Valuation Ledger
          </h1>
          <p className="text-slate-500 mt-1">
            Real-time financial inventory reporting, asset valuation, and costing configurations.
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
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-blue-100 transition duration-200"
          >
            <Settings className="w-4 h-4" />
            Cost Settings
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Recalculating layer costs and compiling report...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Total Valuation Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-md p-6 border border-slate-800 relative overflow-hidden">
              <div className="absolute right-4 top-4 text-indigo-400/20">
                <DollarSign className="w-24 h-24 stroke-[1.5]" />
              </div>
              <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs tracking-wider uppercase mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                Company Assets
              </div>
              <div className="text-sm text-slate-300">Total Inventory Valuation</div>
              <div className="text-3xl font-black mt-2 tracking-tight">
                {formatCurrency(valuationData.company_total_value)}
              </div>
              <div className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-300" />
                Aggregated valuation across all operational sites
              </div>
            </div>

            {/* Total Items Card */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Catalog Coverage</span>
                  <h3 className="text-sm font-medium text-slate-700 mt-1">Valued Unique Items</h3>
                </div>
                <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Package className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-black text-slate-800 tracking-tight">
                  {valuationData.items.length}
                </div>
                <div className="text-xs text-slate-500 mt-1.5">
                  Distinct item-warehouse combinations
                </div>
              </div>
            </div>

            {/* Config State Card */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Configuration</span>
                  <h3 className="text-sm font-medium text-slate-700 mt-1">Costing Rules</h3>
                </div>
                <span className="p-2.5 bg-slate-50 text-slate-600 rounded-xl">
                  <Settings className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {settings.inventory_costing_method}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    settings.allow_negative_inventory 
                      ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}>
                    {settings.allow_negative_inventory ? "Negative Stock: On" : "Negative Stock: Safe"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Costing method in current tenant config
                </div>
              </div>
            </div>

          </div>

          {/* Breakdowns section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Warehouse Breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Warehouse className="w-5 h-5 text-blue-600" />
                Warehouse Valuation Breakdown
              </h3>
              <div className="space-y-4">
                {Object.entries(valuationData.warehouse_totals).map(([whName, total]) => {
                  const percentage = valuationData.company_total_value > 0 
                    ? (total / valuationData.company_total_value) * 100 
                    : 0;
                  return (
                    <div key={whName} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-700">{whName}</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(total)} <span className="text-slate-400 font-normal text-xs">({percentage.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(valuationData.warehouse_totals).length === 0 && (
                  <p className="text-center text-slate-400 py-6 text-sm">No warehouse assets to display.</p>
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-indigo-600" />
                Category Valuation Breakdown
              </h3>
              <div className="space-y-4">
                {Object.entries(valuationData.category_totals).map(([catName, total]) => {
                  const percentage = valuationData.company_total_value > 0 
                    ? (total / valuationData.company_total_value) * 100 
                    : 0;
                  return (
                    <div key={catName} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-700">{catName}</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(total)} <span className="text-slate-400 font-normal text-xs">({percentage.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(valuationData.category_totals).length === 0 && (
                  <p className="text-center text-slate-400 py-6 text-sm">No category assets to display.</p>
                )}
              </div>
            </div>

          </div>

          {/* Ledger Table Section */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            
            {/* Table Filters */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-slate-700">Stock Valuation Ledger</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search SKU or Name..."
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-200 w-60"
                  />
                </div>

                {/* Warehouse Filter */}
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-200"
                >
                  <option value="all">All Warehouses</option>
                  {warehouses.map(wh => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                </select>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-200"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table Element */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Item SKU / Name</th>
                    <th className="px-6 py-4">Warehouse</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Qty On Hand</th>
                    <th className="px-6 py-4 text-right">Avg Unit Cost</th>
                    <th className="px-6 py-4 text-right">Total Inventory Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-slate-900">{item.sku}</div>
                        <div className="text-sm font-medium text-slate-600 mt-0.5">{item.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          <Warehouse className="w-3.5 h-3.5" />
                          {item.warehouse_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {item.category_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${
                          item.quantity_on_hand < 0 
                            ? 'text-rose-600' 
                            : 'text-slate-800'
                        }`}>
                          {item.quantity_on_hand.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-medium text-slate-600">
                          {formatCurrency(item.unit_cost)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${
                          item.inventory_value < 0
                            ? 'text-rose-600'
                            : 'text-indigo-600'
                        }`}>
                          {formatCurrency(item.inventory_value)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No valued stock layers found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footnotes */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex justify-between text-xs text-slate-500">
              <div>
                Showing <strong>{filteredItems.length}</strong> items of {valuationData.items.length} total.
              </div>
              <div className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Valuation computed using current costing setting layers.
              </div>
            </div>

          </div>
        </>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden transform scale-100 transition-all duration-300">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Valuation & Cost Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSettings}>
              <div className="p-6 space-y-6">
                
                {/* Costing Method Selector */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">
                    Valuation Costing Method
                  </label>
                  <p className="text-xs text-slate-400">
                    Determines how consumption consumes asset cost layers.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {[
                      { key: 'FIFO', title: 'FIFO (First-In, First-Out)', desc: 'Consumes oldest cost layers first. Recommended standard.' },
                      { key: 'WAC', title: 'Weighted Average Cost (WAC)', desc: 'Recalculates average unit cost per receipt. (Phase 12B)' },
                      { key: 'STANDARD', title: 'Standard Cost', desc: 'Values stock at predetermined fixed standard rates. (Phase 12B)' }
                    ].map((item) => (
                      <label 
                        key={item.key}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition duration-200 ${
                          settings.inventory_costing_method === item.key
                            ? 'border-blue-500 bg-blue-50/45 text-blue-900 ring-2 ring-blue-500/10'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="costing_method"
                          value={item.key}
                          checked={settings.inventory_costing_method === item.key}
                          disabled={!isAuthorizedToEdit}
                          onChange={(e) => setSettings({...settings, inventory_costing_method: e.target.value})}
                          className="mt-1 accent-blue-600"
                        />
                        <div>
                          <div className="text-sm font-bold">{item.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Negative Inventory Toggle */}
                <div className="space-y-2 border-t border-slate-100 pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <label className="text-sm font-bold text-slate-700 block">
                        Allow Negative Inventory
                      </label>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        Permit stock issue when physical quantities are depleted, creating negative cost layers.
                      </span>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.allow_negative_inventory}
                        disabled={!isAuthorizedToEdit}
                        onChange={(e) => setSettings({...settings, allow_negative_inventory: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {settings.allow_negative_inventory && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 mt-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700 font-medium">
                        <strong>Warning:</strong> Allowing negative inventory can lead to temporarily skewed valuations and require adjustments on receipt reconciliation.
                      </p>
                    </div>
                  )}
                </div>

                {/* Authorization alert */}
                {!isAuthorizedToEdit && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-600">
                      You are in view-only mode. Setting changes can only be posted by administrators, super admins, or finance managers.
                    </p>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition duration-200"
                >
                  Close
                </button>
                {isAuthorizedToEdit && (
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition duration-200 disabled:opacity-55 flex items-center gap-1.5"
                  >
                    {savingSettings && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Save Config
                  </button>
                )}
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
