import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Calendar, Play, Shield, Settings, CheckCircle, AlertTriangle, Layers, Clock } from 'lucide-react';

export default function CapacityPlanning() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [runningPlanId, setRunningPlanId] = useState<string | null>(null);

  // Form states
  const [planNumber, setPlanNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [schedulingMode, setSchedulingMode] = useState('FORWARD');
  const [freezeDate, setFreezeDate] = useState('');

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/capacity/plans');
      setPlans(response.data || []);
    } catch (err) {
      console.error('Failed to fetch plans', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    // Pre-populate default plan details
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + 30);
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(future.toISOString().split('T')[0]);
    setPlanNumber(`CAP-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planNumber || !startDate || !endDate) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setGenerating(true);
    try {
      const payload = {
        plan_number: planNumber,
        planning_start_date: new Date(startDate).toISOString(),
        planning_end_date: new Date(endDate).toISOString(),
        scheduling_mode: schedulingMode,
        schedule_freeze_date: freezeDate ? new Date(freezeDate).toISOString() : null,
      };
      const response = await api.post('/capacity/plan', payload);
      toast.success(`Capacity Plan ${response.data.plan_number} generated successfully!`);
      // Refresh list
      fetchPlans();
      // Reset plan number
      const today = new Date();
      setPlanNumber(`CAP-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRunScheduling = async (planId: string) => {
    setRunningPlanId(planId);
    try {
      const response = await api.post(`/capacity/plan/${planId}/run`);
      toast.success(`Finite capacity scheduling completed for Plan: ${response.data.plan_number}`);
      fetchPlans();
    } catch (err) {
      console.error(err);
    } finally {
      setRunningPlanId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <Layers className="w-10 h-10 text-indigo-600 animate-pulse" />
            APS Capacity Planning
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Create planning horizons, configure constraints, and execute finite capacity scheduling.
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Panel */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-600" />
            New Capacity Horizon
          </h2>
          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Plan Code / Number</label>
              <input
                type="text"
                value={planNumber}
                onChange={e => setPlanNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Scheduling Mode</label>
              <select
                value={schedulingMode}
                onChange={e => setSchedulingMode(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-slate-700"
              >
                <option value="FORWARD">FORWARD (First-Available Slot)</option>
                <option value="BACKWARD">BACKWARD (JIT from Due Date)</option>
                <option value="HYBRID">HYBRID (Constraint-Dynamic)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                Schedule Freeze Date (Optional)
              </label>
              <input
                type="date"
                value={freezeDate}
                onChange={e => setFreezeDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                Operations scheduled on or before this date will remain locked.
              </p>
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold py-3 rounded-xl transition shadow-lg disabled:opacity-50 mt-4 cursor-pointer"
            >
              {generating ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Generating Horizon...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  Generate Capacity Plan
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Plans List */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            Active Planning Horizons
          </h2>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Clock className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
              <AlertTriangle className="w-10 h-10 text-slate-300" />
              <p className="font-semibold text-slate-500">No Capacity Plans Found</p>
              <p className="text-sm">Create a plan on the left to initialize capacity calendars.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {plans.map((plan: any) => (
                <div
                  key={plan.id}
                  className="p-5 border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-slate-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-lg">{plan.plan_number}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                        plan.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : plan.status === 'DRAFT' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : 'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Horizon: <strong>{new Date(plan.planning_start_date).toLocaleDateString()}</strong> - <strong>{new Date(plan.planning_end_date).toLocaleDateString()}</strong></span>
                      <span>Mode: <strong>{plan.scheduling_mode}</strong></span>
                      {plan.schedule_freeze_date && (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Frozen before {new Date(plan.schedule_freeze_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunScheduling(plan.id)}
                      disabled={runningPlanId === plan.id}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {runningPlanId === plan.id ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          Run Scheduling
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
