import React from 'react';
import { Fingerprint, Clock, CalendarCheck } from 'lucide-react';

export function AttendanceCenter() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Fingerprint className="w-8 h-8 text-indigo-600" />
            Attendance Terminal
          </h1>
          <p className="text-slate-500 mt-1">Live punch-in / punch-out and timesheet tracking.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="text-6xl font-black text-slate-800 mb-2">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        <div className="text-slate-500 mb-8">{new Date().toLocaleDateString()}</div>
        
        <div className="flex justify-center gap-4">
          <button className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-xl hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg shadow-emerald-200">
            <Fingerprint className="w-6 h-6" />
            PUNCH IN
          </button>
          <button className="bg-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold text-xl hover:bg-slate-300 transition flex items-center gap-2">
            PUNCH OUT
          </button>
        </div>
      </div>
    </div>
  );
}
