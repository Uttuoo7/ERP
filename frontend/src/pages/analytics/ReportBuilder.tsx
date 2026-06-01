import React from 'react';
import { LayoutTemplate, Filter, Download } from 'lucide-react';

export function ReportBuilder() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <LayoutTemplate className="w-8 h-8 text-indigo-600" />
            Custom Report Builder
          </h1>
          <p className="text-slate-500 mt-1">Dynamically query ERP data to build custom MIS reports.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 h-[600px]">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
            <Filter className="w-4 h-4" /> Data Sources
          </h3>
          <div className="space-y-2">
             <div className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer font-medium text-slate-600 text-sm">Finance Ledgers</div>
             <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg cursor-pointer font-medium text-sm">Inventory Movements</div>
             <div className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer font-medium text-slate-600 text-sm">Production Orders</div>
             <div className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer font-medium text-slate-600 text-sm">HR Attendance</div>
          </div>
        </div>
        
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex items-center justify-center bg-slate-50">
          <div className="text-center text-slate-400">
            <LayoutTemplate className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-600 text-lg">Report Canvas</h3>
            <p className="text-sm mt-1">Select data sources and dimensions to generate visualization.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
