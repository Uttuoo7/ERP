import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Calendar, Filter, Clock, Search, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';

export default function ProductionScheduling() {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [requirements, setRequirements] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [workCenters, setWorkCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkCenterId, setSelectedWorkCenterId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const plansRes = await api.get('/capacity/plans');
        setPlans(plansRes.data || []);
        if (plansRes.data?.length > 0) {
          setSelectedPlanId(plansRes.data[0].id);
        }

        const wcRes = await api.get('/work-centers');
        setWorkCenters(wcRes.data || []);

        const woRes = await api.get('/work-orders');
        setWorkOrders(woRes.data || []);
      } catch (err) {
        console.error('Failed to fetch initial scheduling data', err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedPlanId) return;
    const fetchRequirements = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/capacity/plan/${selectedPlanId}/requirements`);
        setRequirements(response.data || []);
      } catch (err) {
        console.error('Failed to fetch plan requirements', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequirements();
  }, [selectedPlanId]);

  // Map requirements to human readable list
  const mappedSchedule = requirements.map(req => {
    const wo = workOrders.find(w => w.id === req.work_order_id);
    const wc = workCenters.find(c => c.id === req.work_center_id);
    return {
      ...req,
      wo_number: wo?.wo_number || wo?.work_order_number || 'WO-Unknown',
      wo_priority: wo?.priority || 'MEDIUM',
      wo_customer_priority: wo?.customer_priority || 'MEDIUM',
      wo_qty: wo?.quantity || 0,
      wc_name: wc?.name || 'Unknown Center',
      wc_code: wc?.code || '',
    };
  });

  // Filter schedule
  const filteredSchedule = mappedSchedule.filter(item => {
    const matchesSearch = item.wo_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWC = selectedWorkCenterId ? item.work_center_id === selectedWorkCenterId : true;
    const matchesPriority = selectedPriority ? item.wo_priority === selectedPriority : true;
    return matchesSearch && matchesWC && matchesPriority;
  });

  // Sort: prioritize Critical/High/Medium/Low, then by work order number
  const priorityOrder: any = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
  const sortedSchedule = [...filteredSchedule].sort((a, b) => {
    const pA = priorityOrder[a.wo_priority] ?? 4;
    const pB = priorityOrder[b.wo_priority] ?? 4;
    if (pA !== pB) return pA - pB;
    return a.wo_number.localeCompare(b.wo_number);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600 animate-pulse" />
            Production Gantt & Scheduling
          </h1>
          <p className="text-slate-500 mt-1">
            Explore finite production timelines, sequencing priorities, and resource allocations.
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

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Work Order..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Work Center filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedWorkCenterId}
              onChange={e => setSelectedWorkCenterId(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-600"
            >
              <option value="">All Work Centers</option>
              {workCenters.map(wc => (
                <option key={wc.id} value={wc.id}>{wc.name}</option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={e => setSelectedPriority(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-600"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline Board */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-semibold">Loading scheduling board...</p>
          </div>
        ) : sortedSchedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
            <AlertCircle className="w-12 h-12 text-slate-300" />
            <p className="font-semibold text-slate-500">No Scheduled Operations</p>
            <p className="text-sm">Please generate and run scheduling for the selected plan first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm font-semibold border-b border-slate-100">
                  <th className="p-4 pl-6">Work Order</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Work Center</th>
                  <th className="p-4">Required Hours</th>
                  <th className="p-4">Scheduled Hours</th>
                  <th className="p-4 text-center">Load Status</th>
                  <th className="p-4">Timeline / Capacity Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedSchedule.map((item, index) => {
                  const hasOverload = parseFloat(item.overload_hours) > 0;
                  const schedPercent = parseFloat(item.required_hours) > 0 
                    ? (parseFloat(item.scheduled_hours) / parseFloat(item.required_hours)) * 100 
                    : 100;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      {/* Work Order */}
                      <td className="p-4 pl-6">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-slate-900 text-base">{item.wo_number}</span>
                          <div className="text-xs text-slate-400">Qty: {item.wo_qty} units</div>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${
                          item.wo_priority === 'CRITICAL' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : item.wo_priority === 'HIGH' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : item.wo_priority === 'MEDIUM' 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {item.wo_priority}
                        </span>
                      </td>

                      {/* Work Center */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800">{item.wc_name}</span>
                          <span className="block font-mono text-xs text-slate-400">{item.wc_code}</span>
                        </div>
                      </td>

                      {/* Required Hours */}
                      <td className="p-4 font-mono font-bold text-slate-900">{parseFloat(item.required_hours).toFixed(1)}h</td>

                      {/* Scheduled Hours */}
                      <td className="p-4 font-mono font-bold text-slate-900">{parseFloat(item.scheduled_hours).toFixed(1)}h</td>

                      {/* Load Status */}
                      <td className="p-4 text-center">
                        {hasOverload ? (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-black border border-rose-200">
                            <Clock className="w-3.5 h-3.5" />
                            Overload: {parseFloat(item.overload_hours).toFixed(1)}h
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black border border-emerald-200">
                            <Clock className="w-3.5 h-3.5" />
                            Fully Scheduled
                          </span>
                        )}
                      </td>

                      {/* Timeline bar */}
                      <td className="p-4 pr-6">
                        <div className="w-full max-w-xs space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-400">
                            <span>{schedPercent.toFixed(0)}% Allocated</span>
                            {hasOverload && <span className="text-rose-600">+{parseFloat(item.overload_hours).toFixed(1)}h Delay</span>}
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                            <div 
                              style={{ width: `${Math.min(100, schedPercent)}%` }} 
                              className={`h-full rounded-full transition-all duration-500 ${
                                hasOverload ? 'bg-gradient-to-r from-rose-500 to-amber-500 animate-pulse' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                              }`}
                            />
                            {hasOverload && (
                              <div className="h-full bg-rose-200 animate-pulse flex-1" />
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
