import React from 'react';
import { Truck, Package, Clock, CheckCircle } from 'lucide-react';

export function DispatchHub() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Truck className="w-8 h-8 text-indigo-600" />
            Dispatch & Logistics Hub
          </h1>
          <p className="text-slate-500 mt-1">Manage delivery challans, allocate stock, and track shipments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Clock className="w-6 h-6" /></div>
          <div>
            <div className="text-sm font-bold text-slate-500">Pending SO Dispatches</div>
            <div className="text-2xl font-black text-slate-800 mt-1">0</div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Package className="w-6 h-6" /></div>
          <div>
            <div className="text-sm font-bold text-slate-500">Active Delivery Challans</div>
            <div className="text-2xl font-black text-slate-800 mt-1">0</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle className="w-6 h-6" /></div>
          <div>
            <div className="text-sm font-bold text-slate-500">Delivered Today</div>
            <div className="text-2xl font-black text-slate-800 mt-1">0</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm h-[500px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No pending dispatches</h3>
          <p className="text-sm mt-1">All approved sales orders have been fulfilled.</p>
        </div>
      </div>
    </div>
  );
}
