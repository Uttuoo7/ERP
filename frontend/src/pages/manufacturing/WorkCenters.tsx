import React, { useState } from 'react';
import { Home, Plus, Calendar, Settings, Activity } from 'lucide-react';

export default function WorkCenters() {
  const [centers, setCenters] = useState<any[]>([
    { id: '1', code: 'WC-LASER-01', name: 'Precision Laser Cutter', capacity_per_day: 8.0, cost_per_hour: 45.0, efficiency: 95.0, status: 'ACTIVE' },
    { id: '2', code: 'WC-CNC-02', name: 'CNC 5-Axis Milling', capacity_per_day: 8.0, cost_per_hour: 60.0, efficiency: 92.0, status: 'ACTIVE' },
    { id: '3', code: 'WC-WELD-03', name: 'Robotic Weld Station', capacity_per_day: 16.0, cost_per_hour: 35.0, efficiency: 88.0, status: 'MAINTENANCE' }
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Home className="w-8 h-8 text-indigo-600" />
            Work Centers
          </h1>
          <p className="text-slate-500 mt-1">Manage shop floor machine stations, absorption rates, and load capacities.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition duration-150 shadow-md">
          <Plus className="w-5 h-5" />
          Add Work Center
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {centers.map(wc => (
          <div key={wc.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">{wc.code}</span>
                  <h3 className="text-lg font-bold text-slate-800 mt-2">{wc.name}</h3>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  wc.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {wc.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 pt-2">
                <div>
                  <span className="text-slate-400 block text-xs uppercase font-semibold">Capacity/Day</span>
                  <strong className="text-slate-800 text-base">{wc.capacity_per_day} Hours</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs uppercase font-semibold">Absorption Rate</span>
                  <strong className="text-slate-800 text-base">${wc.cost_per_hour}/Hr</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs uppercase font-semibold">Efficiency</span>
                  <strong className="text-slate-800 text-base">{wc.efficiency}%</strong>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between gap-2">
              <button className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 text-xs font-bold transition">
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
              <button className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 text-xs font-bold transition">
                <Activity className="w-4 h-4" />
                Downtime
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
