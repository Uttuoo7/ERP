import React from 'react';
import { Calendar, Play, Settings } from 'lucide-react';

export function ProductionPlanningBoard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            Production Planning Board
          </h1>
          <p className="text-slate-500 mt-1">Schedule and release enterprise production orders.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No Orders Planned</h3>
          <p className="text-sm mt-1">Convert a Sales Order to a Production Order to begin scheduling.</p>
        </div>
      </div>
    </div>
  );
}
