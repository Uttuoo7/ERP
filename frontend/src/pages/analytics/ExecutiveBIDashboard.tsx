import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Activity, AlertCircle } from 'lucide-react';

const data = [
  { name: 'Jan', revenue: 4000, expenses: 2400 },
  { name: 'Feb', revenue: 3000, expenses: 1398 },
  { name: 'Mar', revenue: 2000, expenses: 9800 },
  { name: 'Apr', revenue: 2780, expenses: 3908 },
  { name: 'May', revenue: 1890, expenses: 4800 },
  { name: 'Jun', revenue: 2390, expenses: 3800 },
  { name: 'Jul', revenue: 3490, expenses: 4300 },
];

export function ExecutiveBIDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-indigo-600" />
            Executive BI Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Enterprise performance overview and strategic metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <DollarSign className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">YTD Revenue</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">$14.5M</div>
          <div className="text-sm text-emerald-600 font-medium mt-1">↑ 12% vs last year</div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <Activity className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Gross Margin</h3>
          </div>
          <div className="text-3xl font-black text-emerald-600">32.4%</div>
          <div className="text-sm text-emerald-600 font-medium mt-1">↑ 2.1% vs last year</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Inventory Turn</h3>
          </div>
          <div className="text-3xl font-black text-amber-600">8.2x</div>
          <div className="text-sm text-rose-600 font-medium mt-1">↓ 0.5x vs last month</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-rose-500">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Open Incidents</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">4</div>
          <div className="text-sm text-slate-500 font-medium mt-1">Awaiting resolution</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-slate-800 text-lg mb-6">Revenue vs Expenses (Monthly)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="expenses" stroke="#e11d48" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center justify-between">
            AI Business Insights
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Live</span>
          </h3>
          <div className="space-y-4">
             <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3">
               <AlertCircle className="text-amber-600 w-5 h-5 shrink-0" />
               <div>
                 <h4 className="font-bold text-amber-900 text-sm">Inventory Anomaly Detected</h4>
                 <p className="text-sm text-amber-800 mt-1">Abnormal stock consumption detected for RM-104. Consumption rate 300% above 30-day moving average.</p>
               </div>
             </div>
             
             <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex gap-3">
               <TrendingUp className="text-emerald-600 w-5 h-5 shrink-0" />
               <div>
                 <h4 className="font-bold text-emerald-900 text-sm">Fulfillment Forecast</h4>
                 <p className="text-sm text-emerald-800 mt-1">Based on current production rates, order fulfillment is projected to hit 98% this week.</p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
