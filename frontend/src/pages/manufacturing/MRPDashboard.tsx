import React from 'react';
import { PackageSearch, RefreshCw, AlertTriangle } from 'lucide-react';

export function MRPDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <PackageSearch className="w-8 h-8 text-indigo-600" />
            MRP & Shortage Recommendations
          </h1>
          <p className="text-slate-500 mt-1">Material Requirement Planning based on active sales and production orders.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" /> Run MRP Engine
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <PackageSearch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No Shortages Detected</h3>
          <p className="text-sm mt-1">Run the MRP Engine to re-calculate raw material requirements.</p>
        </div>
      </div>
    </div>
  );
}
