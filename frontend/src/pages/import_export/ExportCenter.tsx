import React, { useState } from 'react';
import { DownloadCloud, FileSpreadsheet, Calendar, Filter } from 'lucide-react';
import api from "../../api";

export function ExportCenter() {
  const [module, setModule] = useState('vendors');
  const [loading, setLoading] = useState(false);

  // We are not actually implementing the export endpoints yet, just standardizing UI.
  // The backend could easily map `/bulk/export/${module}` to return excel files using pandas
  
  const handleExport = async () => {
    setLoading(true);
    try {
      // Fake download logic for demo purposes
      // window.open(`http://127.0.0.1:8000/api/bulk/export/${module}`, '_blank');
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert(`Export for ${module} successfully generated!`);
    } catch (e) {
      console.error(e);
      alert("Failed to export data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <DownloadCloud className="w-8 h-8 text-indigo-600" />
          Enterprise Data Export
        </h1>
        <p className="text-slate-500 mt-1">Generate beautifully formatted Excel files for ERP masters and reports.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-8">
        
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Export Module</label>
            <select 
              className="w-full border-slate-200 rounded-lg shadow-sm p-3"
              value={module}
              onChange={e => setModule(e.target.value)}
            >
              <optgroup label="Master Data">
                <option value="vendors">Vendor Master</option>
                <option value="items">Item Catalog</option>
                <option value="warehouses">Warehouses</option>
              </optgroup>
              <optgroup label="Financial Reports">
                <option value="aging">Vendor Aging Report</option>
                <option value="ledger">Vendor Ledger</option>
                <option value="tds">TDS Summary</option>
              </optgroup>
              <optgroup label="Transactions">
                <option value="pos">Purchase Orders</option>
                <option value="grns">Goods Receipt Notes (GRN)</option>
              </optgroup>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Date Range (Optional)</label>
            <div className="flex items-center gap-2">
              <input type="date" className="w-full border-slate-200 rounded-lg shadow-sm p-2 text-sm text-slate-600" />
              <span className="text-slate-400">to</span>
              <input type="date" className="w-full border-slate-200 rounded-lg shadow-sm p-2 text-sm text-slate-600" />
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
          <h4 className="font-bold text-slate-700 flex items-center gap-2"><Filter className="w-4 h-4" /> Export Options</h4>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500" /> Include Headers
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500" /> Apply Enterprise Formatting
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" /> Active Records Only
            </label>
          </div>
        </div>

        <button 
          onClick={handleExport}
          disabled={loading}
          className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300"
        >
          {loading ? (
            "Generating Spreadsheet..."
          ) : (
            <><FileSpreadsheet className="w-5 h-5" /> Generate & Download Excel</>
          )}
        </button>

      </div>
    </div>
  );
}
