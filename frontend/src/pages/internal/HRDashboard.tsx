import React from 'react';
import { Users, Clock, Calendar, Briefcase } from 'lucide-react';

export function HRDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Human Resources Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Enterprise employee operations and strength overview.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <Users className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Total Employees</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">142</div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Present Today</h3>
          </div>
          <div className="text-3xl font-black text-emerald-600">128</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <Calendar className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">On Leave</h3>
          </div>
          <div className="text-3xl font-black text-amber-600">12</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-rose-500">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <Briefcase className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Open Vacancies</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">5</div>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[400px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">Employee Directory</h3>
          <p className="text-sm mt-1">Select a department to view organizational structure.</p>
        </div>
      </div>
    </div>
  );
}
