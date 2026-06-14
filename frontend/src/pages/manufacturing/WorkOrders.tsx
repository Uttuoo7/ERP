import React, { useState } from 'react';
import { ClipboardList, Plus, Play, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

export default function WorkOrders() {
  const [orders, setOrders] = useState<any[]>([
    { id: '1', wo_number: 'WO-20260614-ABC', item_name: 'Robot Chassis v2', quantity: 50.0, planned_start: '2026-06-14', status: 'IN_PROGRESS' },
    { id: '2', wo_number: 'WO-20260614-DEF', item_name: 'LiDAR Bracket', quantity: 150.0, planned_start: '2026-06-15', status: 'PLANNED' },
    { id: '3', wo_number: 'WO-20260614-XYZ', item_name: 'Core Sensor Hub', quantity: 30.0, planned_start: '2026-06-12', status: 'QC_PENDING' }
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            Work Orders
          </h1>
          <p className="text-slate-500 mt-1">Release work orders, allocate inventory requirements, and track active production lines.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition duration-150 shadow-md">
          <Plus className="w-5 h-5" />
          New Work Order
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b border-slate-200">
              <th className="p-4">WO Number</th>
              <th className="p-4">Finished Good</th>
              <th className="p-4">Quantity</th>
              <th className="p-4">Planned Start</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50 transition">
                <td className="p-4 font-mono font-bold text-slate-900">{order.wo_number}</td>
                <td className="p-4 font-semibold">{order.item_name}</td>
                <td className="p-4 font-bold">{order.quantity} units</td>
                <td className="p-4 text-slate-500">{order.planned_start}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    order.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-700' :
                    order.status === 'QC_PENDING' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-4 flex items-center gap-2">
                  {order.status === 'PLANNED' && (
                    <button className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                      <Play className="w-3.5 h-3.5" />
                      Release
                    </button>
                  )}
                  {order.status === 'QC_PENDING' && (
                    <button className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-lg transition">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Inspect
                    </button>
                  )}
                  <button className="text-slate-500 hover:text-slate-700 text-xs font-bold px-2 py-1">Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
