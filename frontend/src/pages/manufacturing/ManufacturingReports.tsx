import React, { useState } from 'react';
import { BarChart3, Search, RotateCcw, AlertTriangle, FileText, CheckCircle } from 'lucide-react';

export default function ManufacturingReports() {
  const [recallSearch, setRecallSearch] = useState('');
  const [genealogy, setGenealogy] = useState<any>(null);

  const handleSearch = () => {
    if (!recallSearch) return;
    setGenealogy({
      batch_number: recallSearch,
      product_name: 'Robot Chassis v2',
      produced_qty: 50.0,
      yield_percent: 96.0,
      source_materials: [
        { component_item: 'Steel Sheet 2mm', batch_number: 'LOT-STEEL-4981', qty: 100.0 },
        { component_item: 'Laser Gas Cartridge', batch_number: 'LOT-GAS-1190', qty: 2.0 }
      ]
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-indigo-600" />
          Manufacturing Reports & Traceability
        </h1>
        <p className="text-slate-500 mt-1">Audit genealogy tracking, run forward/backward product recalls, and extract production summaries.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <FileText className="w-8 h-8 text-indigo-600" />
          <h3 className="font-bold text-slate-800">Production Summary</h3>
          <p className="text-xs text-slate-500">Summary of total quantities completed, scrap rates, and actual costs across active periods.</p>
          <button className="text-indigo-600 hover:text-indigo-700 text-sm font-bold block pt-1.5 transition">Download CSV →</button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <CheckCircle className="w-8 h-8 text-indigo-600" />
          <h3 className="font-bold text-slate-800">QC Compliance Logs</h3>
          <p className="text-xs text-slate-500">Extract logs of all passed, failed, and rework quality inspections for compliance certification.</p>
          <button className="text-indigo-600 hover:text-indigo-700 text-sm font-bold block pt-1.5 transition">Download CSV →</button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <AlertTriangle className="w-8 h-8 text-indigo-600" />
          <h3 className="font-bold text-slate-800">Scrap & Cost Analysis</h3>
          <p className="text-xs text-slate-500">Drill down into scrap causes, material wastage levels, and financial scrap variances.</p>
          <button className="text-indigo-600 hover:text-indigo-700 text-sm font-bold block pt-1.5 transition">Download CSV →</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-bold text-slate-800 text-lg">Product Recall & Genealogy Search</h3>
          <p className="text-slate-500 text-sm mt-0.5">Trace components used in finished good batches or search by component lot numbers.</p>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter Batch Number (e.g. BAT-A87F90)"
            value={recallSearch}
            onChange={(e) => setRecallSearch(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition duration-150 shadow-md"
          >
            <Search className="w-5 h-5" />
            Search Genealogy
          </button>
        </div>

        {genealogy && (
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 space-y-4">
            <div>
              <h4 className="font-bold text-slate-800 text-lg">Batch details: {genealogy.batch_number}</h4>
              <p className="text-slate-500 text-sm mt-0.5">Product: {genealogy.product_name} | Yield: {genealogy.yield_percent}%</p>
            </div>

            <div className="space-y-3">
              <h5 className="font-semibold text-slate-700 text-xs uppercase block tracking-wider">Source Raw Material Batches</h5>
              {genealogy.source_materials.map((mat: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 rounded-lg p-3 text-sm text-slate-600">
                  <span>{mat.component_item}</span>
                  <span className="font-mono text-slate-800 font-bold">Lot: {mat.batch_number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
