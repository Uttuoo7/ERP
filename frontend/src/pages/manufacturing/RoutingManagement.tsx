import React, { useState } from 'react';
import { GitBranch, Plus, Compass, Clock, Home } from 'lucide-react';

export default function RoutingManagement() {
  const [routings, setRoutings] = useState<any[]>([
    {
      id: '1',
      item_name: 'Robot Chassis v2',
      revision: 'V2.1',
      status: 'ACTIVE',
      operations: [
        { sequence_no: 10, operation_name: 'Laser Cutting', work_center_code: 'WC-LASER-01', setup_time: 15, run_time: 5 },
        { sequence_no: 20, operation_name: 'CNC Bending', work_center_code: 'WC-CNC-02', setup_time: 10, run_time: 3 },
        { sequence_no: 30, operation_name: 'Chassis Welding', work_center_code: 'WC-WELD-03', setup_time: 30, run_time: 12 }
      ]
    }
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-indigo-600" />
            Routing & Operations
          </h1>
          <p className="text-slate-500 mt-1">Configure sequences of work center operations, setup times, and run rates.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition duration-150 shadow-md">
          <Plus className="w-5 h-5" />
          Create Routing
        </button>
      </div>

      {routings.map(r => (
        <div key={r.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{r.item_name}</h2>
              <p className="text-slate-500 text-sm mt-0.5">Revision: {r.revision} | Status: <span className="text-emerald-600 font-bold">{r.status}</span></p>
            </div>
            <button className="text-indigo-600 hover:text-indigo-700 text-sm font-bold transition">Edit Sequence</button>
          </div>

          <div className="space-y-3">
            {r.operations.map((op: any) => (
              <div key={op.sequence_no} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 border border-slate-150 rounded-xl gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600">
                    {op.sequence_no}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{op.operation_name}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Home className="w-3.5 h-3.5" />
                      {op.work_center_code}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Setup: <strong>{op.setup_time} min</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Run: <strong>{op.run_time} min</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
