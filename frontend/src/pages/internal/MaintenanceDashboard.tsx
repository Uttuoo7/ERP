import React from 'react';
import { Wrench, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

export function MaintenanceDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-indigo-600" />
            Plant Maintenance Center
          </h1>
          <p className="text-slate-500 mt-1">Manage machine breakdowns and preventive schedules.</p>
        </div>
        <button className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-rose-700 transition shadow-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Report Breakdown
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-rose-500">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Active Breakdowns</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">2</div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Preventive Due</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">5</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Activity className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">MTTR (Month)</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">4.2 <span className="text-sm font-medium text-slate-500">hours</span></div>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[400px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">Maintenance Logs</h3>
          <p className="text-sm mt-1">All service history and spare parts usage.</p>
        </div>
      </div>
    </div>
  );
}
