import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Clock, Shield, Loader2, Inbox, 
  History, MessageSquare, AlertTriangle, ChevronRight, CornerDownRight 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWorkflowInbox, actionWorkflowTask, getWorkflowHistory } from '../api';
import { enrichTaskContext, defaultContext } from '../services/approvalEnrichmentService';
import type { BusinessContext } from '../services/approvalEnrichmentService';

// Extract actual types based on WorkflowInbox
interface Task {
  id: string;
  workflow_instance_id: string;
  assigned_role: string;
  status: string;
  created_at: string;
  step: { name: string; step_number: number; condition_expression: string | null; };
  instance?: { entity_id: string; status: string; created_at: string; };
  entity_type?: string;
  entity_ref?: string;
}

export default function ApprovalWorkCenter() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  
  const [history, setHistory] = useState<any[]>([]);
  const [businessContext, setBusinessContext] = useState<BusinessContext>(defaultContext);
  const [comments, setComments] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  // Derive SLA KPIs strictly from timestamps
  const now = new Date().getTime();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  const metrics = {
    dueToday: tasks.filter(t => (now - new Date(t.created_at).getTime()) < ONE_DAY).length,
    overdue: tasks.filter(t => (now - new Date(t.created_at).getTime()) > (2 * ONE_DAY)).length,
    escalated: 0, // Genuine escalations would come from a flag on the task
    atRisk: tasks.filter(t => {
      const age = now - new Date(t.created_at).getTime();
      return age > ONE_DAY && age <= (2 * ONE_DAY);
    }).length
  };

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await getWorkflowInbox();
      // Auto-sort Priority Queue: Oldest (overdue) first
      const sorted = (res.data || []).sort((a: Task, b: Task) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setTasks(sorted);
      if (sorted.length > 0 && !activeTask) {
        handleRowClick(sorted[0]);
      }
    } catch (err) {
      toast.error('Failed to load approval inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const handleRowClick = async (task: Task) => {
    setActiveTask(task);
    setComments("");
    setLoadingDrawer(true);
    setBusinessContext(defaultContext);
    
    const entityId = task.instance?.entity_id || task.entity_ref;
    try {
      // Fetch workflow history
      if (entityId) {
        const histRes = await getWorkflowHistory(entityId);
        setHistory(histRes.data || []);
      } else {
        setHistory([]);
      }
      
      // Async enrich business context
      const context = await enrichTaskContext(entityId, task.entity_type);
      setBusinessContext(context);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const handleBulkAction = async (action: 'APPROVED' | 'REJECTED') => {
    if (selectedTaskIds.size === 0) return;
    setActioning(true);
    
    try {
      // Process bulk sequentially to avoid backend rate limits/transaction locks
      for (const id of Array.from(selectedTaskIds)) {
        await actionWorkflowTask(id, action, "Bulk Action via Work Center");
      }
      toast.success(`Successfully ${action.toLowerCase()} ${selectedTaskIds.size} tasks.`);
      setSelectedTaskIds(new Set());
      setActiveTask(null);
      await fetchInbox();
    } catch (err) {
      toast.error('Some tasks failed during bulk action. Inbox re-synced.');
      await fetchInbox();
    } finally {
      setActioning(false);
    }
  };

  const handleSingleAction = async (action: 'APPROVED' | 'REJECTED') => {
    if (!activeTask) return;
    setActioning(true);
    try {
      await actionWorkflowTask(activeTask.id, action, comments);
      toast.success(`Task ${action.toLowerCase()} successfully!`);
      setActiveTask(null);
      await fetchInbox();
    } catch (err) {
      // Handled by axios interceptor toast
    } finally {
      setActioning(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedTaskIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTaskIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === tasks.length && tasks.length > 0) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(tasks.map(t => t.id)));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 overflow-hidden text-slate-800">
      
      {/* SLA Dashboard & Global Actions */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-6 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Today</div>
            <div className="text-xl font-black text-slate-900">{metrics.dueToday}</div>
          </div>
          <div className="w-px h-8 bg-slate-100"></div>
          <div>
            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Overdue</div>
            <div className="text-xl font-black text-rose-600">{metrics.overdue}</div>
          </div>
          <div className="w-px h-8 bg-slate-100"></div>
          <div>
            <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">At Risk</div>
            <div className="text-xl font-black text-amber-600">{metrics.atRisk}</div>
          </div>
          <div className="w-px h-8 bg-slate-100"></div>
          <div>
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Escalated</div>
            <div className="text-xl font-black text-indigo-600">{metrics.escalated}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          {selectedTaskIds.size > 0 && (
            <>
              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full mr-2">
                {selectedTaskIds.size} Selected
              </span>
              <button 
                disabled={actioning}
                onClick={() => handleBulkAction('REJECTED')}
                className="px-4 py-1.5 bg-rose-50 text-rose-600 font-bold text-xs rounded hover:bg-rose-100 border border-rose-100 transition-colors"
              >
                Reject
              </button>
              <button 
                disabled={actioning}
                onClick={() => handleBulkAction('APPROVED')}
                className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-all"
              >
                Approve
              </button>
            </>
          )}
          <div className="w-px h-6 bg-slate-200 hidden lg:block mx-1"></div>
          <button className="px-4 py-1.5 bg-white text-slate-600 font-bold text-xs rounded border border-slate-200 hover:bg-slate-50 transition-colors">
            Delegate (Out of Office)
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left Pane: Priority Master Grid */}
        <div className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${activeTask ? 'hidden md:flex md:w-[60%]' : 'w-full'}`}>
          <div className="flex items-center border-b border-slate-100 px-6 shrink-0 h-12 gap-6 bg-slate-50/50">
            <button className="h-full border-b-2 border-indigo-600 text-indigo-600 font-bold text-xs px-2 flex items-center gap-2">
              Priority Queue <span className="bg-indigo-100 text-indigo-700 py-0.5 px-1.5 rounded-full text-[9px]">{tasks.length}</span>
            </button>
            <button className="h-full border-b-2 border-transparent text-slate-500 font-semibold text-xs px-2 hover:text-slate-700">
              Delegated to Me
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Inbox className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-800">Inbox Zero</p>
                <p className="text-xs mt-1">No pending approvals at this time.</p>
              </div>
            ) : (
              <>
                {/* Mobile Card List (Touch-Friendly Viewports) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {tasks.map(task => {
                    const isSelected = selectedTaskIds.has(task.id);
                    const isActive = activeTask?.id === task.id;
                    const entityStr = task.entity_ref || task.instance?.entity_id || '—';
                    
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => handleRowClick(task)}
                        className={`p-4 flex flex-col gap-2.5 cursor-pointer active:bg-slate-50 transition-colors ${isActive ? 'bg-indigo-50/20 border-l-4 border-indigo-600 pl-3' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="w-4.5 h-4.5 rounded border-slate-350 text-indigo-600 focus:ring-indigo-600"
                              checked={isSelected}
                              onChange={() => toggleSelect(task.id)}
                            />
                            <span className="text-xs font-black text-slate-900">{task.step.name}</span>
                          </div>
                          <span className="text-[9px] font-black text-slate-400">
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center ml-7 text-[10px] font-semibold text-slate-500">
                          <span>Ref: <strong className="text-slate-800">{entityStr}</strong></span>
                          <span className="bg-indigo-50 text-indigo-600 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                            {task.entity_type || 'WORKFLOW'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Grid View */}
                <table className="w-full text-left border-collapse hidden md:table">
                  <thead className="bg-white sticky top-0 z-10 border-b border-slate-100 shadow-sm">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          checked={tasks.length > 0 && selectedTaskIds.size === tasks.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Task ID / Step</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Entity</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Assigned Role</th>
                      <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Created Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tasks.map(task => {
                      const isSelected = selectedTaskIds.has(task.id);
                      const isActive = activeTask?.id === task.id;
                      const entityStr = task.entity_ref || task.instance?.entity_id || '—';
                      
                      return (
                        <tr 
                          key={task.id} 
                          onClick={() => handleRowClick(task)}
                          className={`hover:bg-slate-50 cursor-pointer group transition-colors ${isActive ? 'bg-indigo-50/30' : ''}`}
                        >
                          <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                              checked={isSelected}
                              onChange={() => toggleSelect(task.id)}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className={`text-xs font-bold transition-colors ${isActive ? 'text-indigo-700' : 'text-slate-900 group-hover:text-indigo-600'}`}>{task.step.name}</div>
                            <div className="text-[10px] font-semibold text-slate-400">ID: {task.id.slice(0, 8)}...</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs font-bold text-slate-700">{entityStr}</div>
                            <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 w-fit px-1.5 rounded mt-0.5">{task.entity_type || 'WORKFLOW'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs font-semibold text-slate-600">{task.assigned_role}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-slate-600 font-medium">
                              {new Date(task.created_at).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Right Pane: Approval Drawer / Summary */}
        <div className={`flex-1 flex flex-col bg-slate-50 overflow-y-auto ${!activeTask ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
          {!activeTask ? (
            <div className="text-center p-10 opacity-50">
              <CornerDownRight className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-sm font-bold text-slate-900">Select an Approval</h3>
              <p className="text-xs text-slate-500 mt-1">Review document summary, workflow timeline, and add remarks.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6 pb-20">
              <div className="md:hidden">
                <button onClick={() => setActiveTask(null)} className="text-indigo-600 text-xs font-bold flex items-center mb-4">
                  <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to Priority Queue
                </button>
              </div>

              {/* Fiori-Style Enriched Header */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-slate-50 rounded-bl-2xl border-b border-l border-slate-100">
                   <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                     <AlertTriangle className="w-3 h-3 text-amber-500" /> Enrichment Layer
                   </span>
                </div>
                
                <h2 className="text-lg font-black text-slate-900 pr-32">{activeTask.step.name}</h2>
                <div className="text-xs font-semibold text-slate-500 mt-0.5 mb-5">{activeTask.entity_ref || activeTask.instance?.entity_id || 'Unknown Document'}</div>
                
                {loadingDrawer ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolving business context...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</div>
                      <div className="text-sm font-black text-slate-900 mt-0.5">
                        {businessContext.amount !== null ? `${businessContext.currency} ${businessContext.amount.toLocaleString()}` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor / Party</div>
                      <div className="text-sm font-bold text-slate-700 mt-0.5">{businessContext.vendor}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requestor</div>
                      <div className="text-sm font-bold text-slate-700 mt-0.5">{businessContext.requestor}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</div>
                      <div className="text-sm font-bold text-slate-700 mt-0.5">{businessContext.department}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Commentary */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" /> Manager Remarks
                </h3>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Enter custom remarks for approval or rejection..."
                  className="w-full h-24 p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none mb-4"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    disabled={actioning}
                    onClick={() => handleSingleAction('REJECTED')}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    disabled={actioning}
                    onClick={() => handleSingleAction('APPROVED')}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 border border-transparent hover:bg-indigo-700 shadow-sm rounded-lg transition-all"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                </div>
              </div>

              {/* Timeline Drawer Segment */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" /> Workflow Timeline
                </h3>
                {loadingDrawer ? (
                  <div className="py-4"><Loader2 className="w-5 h-5 text-indigo-600 animate-spin mx-auto" /></div>
                ) : history.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-400 text-center py-4">No prior workflow history found.</p>
                ) : (
                  <div className="relative border-l-2 border-slate-100 pl-4 ml-2 space-y-6">
                    {history.map((log, idx) => (
                      <div key={log.id || idx} className="relative">
                        <span className="absolute -left-[23px] top-0.5 w-3 h-3 bg-indigo-100 rounded-full border-2 border-white flex items-center justify-center">
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                        </span>
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-slate-900">{log.transition_to.replace(/_/g, " ")}</span>
                            <span className="text-[9px] font-bold text-slate-400">
                              {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                          {log.comments && (
                            <div className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-100 p-2 rounded mt-1.5">
                              "{log.comments}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
