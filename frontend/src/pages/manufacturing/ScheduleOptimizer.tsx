import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Settings, RefreshCw, Zap, TrendingUp, Sliders, ShieldAlert, Award } from 'lucide-react';

export default function ScheduleOptimizer() {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  
  // Optimization Outputs
  const [overtimeRecs, setOvertimeRecs] = useState<any[]>([]);
  const [maxOvertime, setMaxOvertime] = useState<number>(4.0);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get('/capacity/plans');
        setPlans(response.data || []);
        if (response.data?.length > 0) {
          setSelectedPlanId(response.data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch plans', err);
      }
    };
    fetchPlans();
  }, []);

  const handleRebalance = async () => {
    if (!selectedPlanId) return;
    setRebalancing(true);
    try {
      const response = await api.post(`/capacity/plan/${selectedPlanId}/rebalance`);
      toast.success(`Rebalancing completed! Reassigned ${response.data.reassigned_count} operations to alternate centers.`);
      // Clear overtime recommendations as capacities have shifted
      setOvertimeRecs([]);
    } catch (err) {
      console.error(err);
    } finally {
      setRebalancing(false);
    }
  };

  const handleSimulateOvertime = async () => {
    if (!selectedPlanId) return;
    setSimulating(true);
    try {
      const response = await api.post(`/capacity/plan/${selectedPlanId}/simulate-overtime?max_overtime=${maxOvertime}`);
      setOvertimeRecs(response.data || []);
      toast.success(`Overtime simulation run complete.`);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Zap className="w-8 h-8 text-violet-600 animate-bounce" />
            APS Schedule Optimizer
          </h1>
          <p className="text-slate-500 mt-1">
            Reallocate overload queues to alternate work centers or simulate overtime requirements.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Control Panel */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Optimizer Tools
          </h3>

          {/* Rebalancing Block */}
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-sm font-black text-slate-700 block">Alternate Center Rebalancing</span>
              <p className="text-xs text-slate-400">
                Moves bottleneck workload to eligible alternate work centers based on capability matching, availability, utilization, and prioritization.
              </p>
            </div>
            <button
              onClick={handleRebalance}
              disabled={rebalancing || !selectedPlanId}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              {rebalancing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Rebalancing load...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Rebalance Alternate Centers
                </>
              )}
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* Overtime Block */}
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-sm font-black text-slate-700 block">Simulate Overtime Capacity</span>
              <p className="text-xs text-slate-400">
                Determine required overtime hours on overloaded calendars to resolve bottlenecks.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Max Overtime Limit</span>
                <span>{maxOvertime} hrs / day</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={maxOvertime}
                onChange={e => setMaxOvertime(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <button
              onClick={handleSimulateOvertime}
              disabled={simulating || !selectedPlanId}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {simulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Simulate Overtime
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Output Panel */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-6">
          <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            Optimization Results & Recs
          </h3>

          {overtimeRecs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
              <Award className="w-12 h-12 text-slate-300" />
              <p className="font-semibold text-slate-500 text-base">No Current Recommendations</p>
              <p className="text-sm">Run an overtime simulation or rebalancing query to view optimization recommendations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {overtimeRecs.map(rec => {
                const isFullyResolved = rec.remaining_overload_hours === 0;

                return (
                  <div key={rec.work_center_id} className="p-4 border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-slate-50/20 transition flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="font-black text-slate-800 text-base block">{rec.work_center_name}</span>
                      <div className="text-sm text-slate-500 flex gap-x-4">
                        <span>Original Overload: <strong>{rec.overload_hours_before.toFixed(1)}h</strong></span>
                        <span>Added Overtime: <strong className="text-indigo-600">+{rec.simulated_overtime_hours_added.toFixed(1)}h</strong></span>
                      </div>
                    </div>

                    <div>
                      {isFullyResolved ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black border border-emerald-200">
                          Bottleneck Resolved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-black border border-rose-200">
                          {rec.remaining_overload_hours.toFixed(1)}h Overload Left
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
