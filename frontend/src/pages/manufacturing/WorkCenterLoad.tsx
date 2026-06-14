import React, { useState, useEffect } from 'react';
import api from '../../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Home, RefreshCw, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

export default function WorkCenterLoad() {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [utilizationData, setUtilizationData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get('/capacity/plans');
        setPlans(response.data || []);
        if (response.data?.length > 0) {
          setSelectedPlanId(response.data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch capacity plans', err);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    if (!selectedPlanId) return;
    const fetchUtilization = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/capacity/plan/${selectedPlanId}/reports/utilization`);
        setUtilizationData(response.data || []);
      } catch (err) {
        console.error('Failed to fetch utilization report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUtilization();
  }, [selectedPlanId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Home className="w-8 h-8 text-indigo-600 animate-pulse" />
            Work Center Load & Utilization
          </h1>
          <p className="text-slate-500 mt-1">
            Compare planned operations against total work center capacities.
          </p>
        </div>

        {/* Plan Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-100 px-4 py-2 rounded-2xl shadow-sm">
          <span className="text-sm font-bold text-slate-500">Plan:</span>
          <select
            value={selectedPlanId}
            onChange={e => setSelectedPlanId(e.target.value)}
            className="border-0 bg-transparent text-sm font-black text-slate-800 focus:ring-0 outline-none cursor-pointer"
          >
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.plan_number}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-semibold">Loading utilization metrics...</p>
        </div>
      ) : utilizationData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-3xl bg-white">
          <AlertTriangle className="w-12 h-12 text-slate-300" />
          <p className="font-semibold text-slate-500">No Utilization Data Found</p>
          <p className="text-sm">Run capacity scheduling first to load utilization data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Charts Panel */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-6">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Planned vs Available Capacity
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="work_center_name" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit="h" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelClassName="font-bold text-slate-800"
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="available_hours" name="Available Hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="planned_hours" name="Planned Hours" fill="#fb7185" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards Breakdown List */}
          <div className="lg:col-span-1 bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-4 max-h-[440px] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800">Utilization Details</h3>
            <div className="space-y-4">
              {utilizationData.map(item => {
                const util = item.utilization_percent;
                const isOverloaded = util > 100;

                return (
                  <div key={item.work_center_id} className="p-4 border border-slate-50 rounded-2xl hover:bg-slate-50 transition space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-800 text-sm block">{item.work_center_name}</span>
                        <span className="font-mono text-xs text-slate-400">{item.work_center_code}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${
                        isOverloaded 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {util.toFixed(1)}%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Load: {item.planned_hours.toFixed(1)}h / {item.available_hours.toFixed(1)}h</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, util)}%` }} 
                          className={`h-full rounded-full ${isOverloaded ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
