import React, { useState } from 'react';
import { DollarSign, ShieldAlert, BarChart, Percent, Clock } from 'lucide-react';

export default function WIPValuation() {
  const [valuation, setValuation] = useState<any>({
    total_wip: 18450.0,
    wip_by_wo: [
      { id: '1', wo_number: 'WO-20260614-ABC', product_name: 'Robot Chassis v2', value: 8550.0, start_date: '2026-06-10' },
      { id: '2', wo_number: 'WO-20260614-XYZ', product_name: 'Core Sensor Hub', value: 9900.0, start_date: '2026-06-08' }
    ],
    aging: {
      '0-7 days': 8550.0,
      '8-15 days': 9900.0,
      '16-30 days': 0.0,
      '30+ days': 0.0
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-indigo-600" />
          WIP Subledger Valuation
        </h1>
        <p className="text-slate-500 mt-1">Audit active work-in-progress inventory valuation balances against G/L accounts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
            GL
          </div>
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase block">Total WIP (GL Account)</span>
            <strong className="text-2xl font-black text-slate-800">${valuation.total_wip.toFixed(2)}</strong>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
            SUB
          </div>
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase block">Total WIP (Subledger)</span>
            <strong className="text-2xl font-black text-slate-800">${valuation.total_wip.toFixed(2)}</strong>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
            0.00
          </div>
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase block">Reconciliation Variance</span>
            <strong className="text-2xl font-black text-emerald-600">$0.00</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 font-bold text-slate-800">WIP by Work Order</div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase border-b border-slate-100">
                <th className="p-4">WO Number</th>
                <th className="p-4">Product</th>
                <th className="p-4 text-right">WIP Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700 text-sm">
              {valuation.wip_by_wo.map((w: any) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-900">{w.wo_number}</td>
                  <td className="p-4">{w.product_name}</td>
                  <td className="p-4 text-right font-bold text-indigo-600">${w.value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">WIP Aging Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(valuation.aging).map(([bucket, val]: any) => (
              <div key={bucket} className="flex justify-between items-center text-sm text-slate-600">
                <span>{bucket}</span>
                <strong className="text-slate-800 font-bold">${val.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
