import React, { useState } from 'react';
import { TrendingUp, BarChart3, CornerDownRight, Percent, Award } from 'lucide-react';

export default function ProductionVariance() {
  const [variances, setVariances] = useState<any[]>([
    {
      wo_number: 'WO-20260614-ABC',
      product_name: 'Robot Chassis v2',
      materials: { standard: 4500.0, actual: 4400.0, diff: -100.0, type: 'Favorable' },
      labor: { standard: 2000.0, actual: 2150.0, diff: 150.0, type: 'Unfavorable' },
      overhead: { standard: 1200.0, actual: 1100.0, diff: -100.0, type: 'Favorable' },
      net: -50.0
    }
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-indigo-600" />
          Production Variance Analysis
        </h1>
        <p className="text-slate-500 mt-1">Review standard costs versus actual costs logged on closed work orders.</p>
      </div>

      {variances.map((v, idx) => (
        <div key={idx} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{v.wo_number} – {v.product_name}</h2>
              <p className="text-slate-500 text-sm mt-0.5">Net Variance: <span className={v.net <= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                ${Math.abs(v.net).toFixed(2)} {v.net <= 0 ? 'Favorable' : 'Unfavorable'}
              </span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-200 rounded-xl p-5 space-y-2">
              <span className="text-slate-400 block text-xs uppercase font-semibold">Material Cost Variance</span>
              <div className="flex justify-between text-sm text-slate-600 pt-1">
                <span>Standard: <strong>${v.materials.standard}</strong></span>
                <span>Actual: <strong>${v.materials.actual}</strong></span>
              </div>
              <strong className={v.materials.diff <= 0 ? 'text-emerald-600 block text-lg pt-1' : 'text-rose-600 block text-lg pt-1'}>
                ${Math.abs(v.materials.diff).toFixed(2)} ({v.materials.type})
              </strong>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 space-y-2">
              <span className="text-slate-400 block text-xs uppercase font-semibold">Labor Cost Variance</span>
              <div className="flex justify-between text-sm text-slate-600 pt-1">
                <span>Standard: <strong>${v.labor.standard}</strong></span>
                <span>Actual: <strong>${v.labor.actual}</strong></span>
              </div>
              <strong className={v.labor.diff <= 0 ? 'text-emerald-600 block text-lg pt-1' : 'text-rose-600 block text-lg pt-1'}>
                ${Math.abs(v.labor.diff).toFixed(2)} ({v.labor.type})
              </strong>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 space-y-2">
              <span className="text-slate-400 block text-xs uppercase font-semibold">Overhead Cost Variance</span>
              <div className="flex justify-between text-sm text-slate-600 pt-1">
                <span>Standard: <strong>${v.overhead.standard}</strong></span>
                <span>Actual: <strong>${v.overhead.actual}</strong></span>
              </div>
              <strong className={v.overhead.diff <= 0 ? 'text-emerald-600 block text-lg pt-1' : 'text-rose-600 block text-lg pt-1'}>
                ${Math.abs(v.overhead.diff).toFixed(2)} ({v.overhead.type})
              </strong>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
