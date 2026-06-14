import React, { useState, useEffect } from 'react';
import api from '../../api';
import { AlertCircle, RefreshCw, ShieldAlert, Award, FileText, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BottleneckAnalysis() {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

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

  const fetchBottleneckData = async () => {
    if (!selectedPlanId) return;
    setLoading(true);
    try {
      const bRes = await api.get(`/capacity/plan/${selectedPlanId}/bottlenecks`);
      setBottlenecks(bRes.data || []);

      const eRes = await api.get(`/capacity/plan/${selectedPlanId}/exceptions`);
      setExceptions(eRes.data || []);
    } catch (err) {
      console.error('Failed to fetch bottleneck analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBottleneckData();
  }, [selectedPlanId]);

  const handleRescheduleOverloads = async () => {
    if (!selectedPlanId) return;
    setResolving(true);
    try {
      const response = await api.post(`/capacity/plan/${selectedPlanId}/reschedule-overloads`);
      toast.success(`Rescheduled overloaded requirements! Shifted count: ${response.data.shifted_count}`);
      fetchBottleneckData();
    } catch (err) {
      console.error(err);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-600 animate-bounce" />
            Constraint & Bottleneck Analysis
          </h1>
          <p className="text-slate-500 mt-1">
            Detect capacity constraints, overload exceptions, and queue times.
          </p>
        </div>

        {/* Plan Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
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

          <button
            onClick={handleRescheduleOverloads}
            disabled={resolving || bottlenecks.length === 0}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition shadow-md disabled:opacity-50 cursor-pointer"
          >
            {resolving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                Auto-Reschedule Overloads
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-semibold">Analyzing capacity constraints...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Bottlenecks Column */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-6">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldAlert className="w-6 h-6 text-rose-500" />
              Resource Bottlenecks
            </h3>
            {bottlenecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-2">
                <Award className="w-10 h-10 text-emerald-500 animate-pulse" />
                <p className="font-semibold text-slate-600 text-base">All Resources Compliant</p>
                <p className="text-sm">No work centers are currently overloaded beyond 100% capacity.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bottlenecks.map(b => (
                  <div key={b.work_center_id} className="p-4 border border-rose-100 bg-rose-50/20 rounded-2xl space-y-2 hover:bg-rose-50/40 transition">
                    <div className="flex justify-between items-start">
                      <span className="font-black text-slate-900">{b.work_center_name}</span>
                      <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-black">
                        {b.utilization_percent.toFixed(1)}% Load
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 flex justify-between">
                      <span>Available: <strong>{b.available_hours.toFixed(1)}h</strong></span>
                      <span>Planned: <strong>{b.planned_hours.toFixed(1)}h</strong></span>
                      <span className="text-rose-600 font-bold">Overload: +{b.overload_hours.toFixed(1)}h</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exceptions Column */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-6 space-y-6">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-6 h-6 text-indigo-500" />
              Capacity Exceptions Log
            </h3>
            {exceptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-2">
                <Award className="w-10 h-10 text-emerald-500 animate-pulse" />
                <p className="font-semibold text-slate-600 text-base">No Exceptions Logged</p>
                <p className="text-sm">All operations are scheduled cleanly without exception alarms.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {exceptions.map(ex => (
                  <div key={ex.id} className="p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                        ex.exception_type === 'LATE_DELIVERY' 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : ex.exception_type === 'MAINTENANCE' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {ex.exception_type}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(ex.exception_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 font-semibold">{ex.message}</p>
                    {ex.late_days > 0 && (
                      <div className="text-xs font-black text-rose-600">
                        Delayed by: {ex.late_days} days
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
