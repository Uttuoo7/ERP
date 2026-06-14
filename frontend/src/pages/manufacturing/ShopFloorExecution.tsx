import React, { useState } from 'react';
import { Cpu, Play, Pause, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';

export default function ShopFloorExecution() {
  const [activeJob, setActiveJob] = useState<any>({
    wo_number: 'WO-20260614-ABC',
    item_name: 'Robot Chassis v2',
    current_op: 'CNC Bending',
    sequence: 20,
    wc_code: 'WC-CNC-02',
    planned_qty: 50,
    good_qty: 48,
    scrap_qty: 2
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <Cpu className="w-8 h-8 text-indigo-600 animate-pulse" />
          Shop Floor Control Console
        </h1>
        <p className="text-slate-500 mt-1">Real-time operator interface to log labor, capture yield quantities, and report machine downtime.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Active Running Job</span>
                <h2 className="text-2xl font-bold text-slate-800 mt-2">{activeJob.wo_number} – {activeJob.item_name}</h2>
              </div>
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs animate-pulse">RUNNING</span>
            </div>

            <div className="border-t border-b border-slate-100 py-4 grid grid-cols-3 gap-4">
              <div>
                <span className="text-slate-400 block text-xs uppercase font-semibold">Operation</span>
                <strong className="text-slate-800 text-base">[{activeJob.sequence}] {activeJob.current_op}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-xs uppercase font-semibold">Work Center</span>
                <strong className="text-slate-800 text-base">{activeJob.wc_code}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-xs uppercase font-semibold">Target Qty</span>
                <strong className="text-slate-800 text-base">{activeJob.planned_qty} units</strong>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm">
                <Pause className="w-5 h-5" />
                Pause Job
              </button>
              <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
                Complete Operation
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Yield & Scrap Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-500 text-xs font-semibold block mb-1">Good Produced Quantity</label>
                <input type="number" defaultValue={activeJob.good_qty} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 transition" />
              </div>
              <div>
                <label className="text-slate-500 text-xs font-semibold block mb-1">Scrapped Quantity</label>
                <input type="number" defaultValue={activeJob.scrap_qty} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold outline-none focus:border-indigo-500 transition" />
              </div>
              <div className="pt-2">
                <span className="text-slate-400 text-xs font-semibold block">Calculated Yield</span>
                <strong className="text-emerald-600 text-2xl font-black">96.0%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
