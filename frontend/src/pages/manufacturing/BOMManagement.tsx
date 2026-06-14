import React, { useState, useEffect } from 'react';
import { Settings, Plus, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export default function BOMManagement() {
  const [boms, setBoms] = useState<any[]>([
    { id: '1', bom_number: 'BOM-CHASSIS-001', item_id: '101', item_name: 'Robot Chassis v2', revision: 'V2.1', status: 'ACTIVE', effective_from: '2026-01-01', total_cost: 450.0 },
    { id: '2', bom_number: 'BOM-SENSOR-002', item_id: '102', item_name: 'LiDAR Bracket', revision: 'V1.0', status: 'DRAFT', effective_from: '2026-06-01', total_cost: 85.0 }
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600 animate-spin-slow" />
            Bill of Materials (BOM)
          </h1>
          <p className="text-slate-500 mt-1">Create, revise, and roll up standard costs for finished goods assembly.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition duration-150 shadow-md">
          <Plus className="w-5 h-5" />
          Create BOM
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b border-slate-200">
              <th className="p-4">BOM Number</th>
              <th className="p-4">Finished Good Item</th>
              <th className="p-4">Revision</th>
              <th className="p-4">Status</th>
              <th className="p-4">Effective From</th>
              <th className="p-4">Std Material Cost</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {boms.map(bom => (
              <tr key={bom.id} className="hover:bg-slate-50 transition">
                <td className="p-4 font-mono font-bold text-slate-900">{bom.bom_number}</td>
                <td className="p-4 font-semibold">{bom.item_name}</td>
                <td className="p-4">{bom.revision}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    bom.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {bom.status === 'ACTIVE' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {bom.status}
                  </span>
                </td>
                <td className="p-4 text-slate-500">{bom.effective_from}</td>
                <td className="p-4 font-bold text-indigo-600">${bom.total_cost.toFixed(2)}</td>
                <td className="p-4">
                  <button className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 text-sm font-bold transition">
                    <FileText className="w-4 h-4" />
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
