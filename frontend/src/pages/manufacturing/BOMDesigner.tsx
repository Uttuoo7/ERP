import React from 'react';
import { Layers, Plus, Save } from 'lucide-react';

export function BOMDesigner() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Layers className="w-8 h-8 text-indigo-600" />
            BOM Designer
          </h1>
          <p className="text-slate-500 mt-1">Design, version, and cost multi-level Bill of Materials.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm">
          + New BOM
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No Active BOMs</h3>
          <p className="text-sm mt-1">Create a new Bill of Materials to start production planning.</p>
        </div>
      </div>
    </div>
  );
}
