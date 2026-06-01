import React from 'react';
import { Factory, TrendingUp, AlertTriangle, Settings, Box } from 'lucide-react';

export function ManufacturingDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Factory className="w-8 h-8 text-indigo-600" />
            Manufacturing Operations
          </h1>
          <p className="text-slate-500 mt-1">Enterprise production overview, efficiency metrics, and active orders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Settings className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Active Production</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">0</div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Material Shortages</h3>
          </div>
          <div className="text-3xl font-black text-amber-600">0</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">OEE Efficiency</h3>
          </div>
          <div className="text-3xl font-black text-emerald-600">92%</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Box className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">FG Produced Today</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">0</div>
        </div>
      </div>
    </div>
  );
}
