import React from 'react';
import { Calendar, Plus } from 'lucide-react';

export function LeaveCenter() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            Leave Management Center
          </h1>
          <p className="text-slate-500 mt-1">Apply for leave and view balance quotas.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Request Leave
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-indigo-500">
          <h3 className="font-bold text-slate-700 mb-1">Casual Leave (CL)</h3>
          <div className="text-3xl font-black text-slate-800">10 <span className="text-sm font-medium text-slate-500">/ 14</span></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-emerald-500">
          <h3 className="font-bold text-slate-700 mb-1">Sick Leave (SL)</h3>
          <div className="text-3xl font-black text-slate-800">5 <span className="text-sm font-medium text-slate-500">/ 7</span></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-amber-500">
          <h3 className="font-bold text-slate-700 mb-1">Earned Leave (EL)</h3>
          <div className="text-3xl font-black text-slate-800">22 <span className="text-sm font-medium text-slate-500">/ 30</span></div>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[400px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No Leave History</h3>
          <p className="text-sm mt-1">Your past leave requests will appear here.</p>
        </div>
      </div>
    </div>
  );
}
