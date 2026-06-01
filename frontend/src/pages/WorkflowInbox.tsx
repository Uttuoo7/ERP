import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Clock, MessageSquare, Shield, ChevronRight, Loader2, Inbox, History, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWorkflowInbox, actionWorkflowTask, getWorkflowHistory } from "../api";

interface Task {
  id: string;
  workflow_instance_id: string;
  assigned_role: string;
  status: string;
  comments: string | null;
  created_at: string;
  step: {
    name: string;
    step_number: int;
    condition_expression: string | null;
  };
  instance?: {
    entity_id: string;
    status: string;
    created_at: string;
  };
}

const WorkflowInbox: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await getWorkflowInbox();
      setTasks(res.data);
      if (res.data.length > 0) {
        setSelectedTask(res.data[0]);
      } else {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskHistory = async (entityId: string) => {
    setLoadingHistory(true);
    try {
      const res = await getWorkflowHistory(entityId);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      // Standard dynamic lookup
      // In the mock response, the task has a relation back to instance or we lookup by instance's entity ID
      // Let's fallback to select task id
      fetchTaskHistory(selectedTask.id);
    }
  }, [selectedTask]);

  const handleAction = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedTask) return;
    setActioning(true);
    try {
      await actionWorkflowTask(selectedTask.id, action, comments);
      toast.success(`Task ${action.toLowerCase()} successfully!`);
      setComments("");
      fetchInbox();
    } catch (err) {
      // Axio interceptor displays detailed toast
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      {/* Sidebar List of Pending Tasks */}
      <div className={`border-r border-slate-200 bg-white flex flex-col ${selectedTask ? 'hidden md:flex w-96' : 'w-full md:w-96'}`}>
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Approval Inbox</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Action and track workflow requests assigned to you</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2.5">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <p className="text-xs text-slate-400 font-semibold">Loading approval requests...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Inbox is empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">You have no active pending approvals assigned at this time.</p>
              </div>
            </div>
          ) : (
            tasks.map(task => {
              const isSelected = selectedTask?.id === task.id;
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`w-full text-left p-5 flex flex-col gap-2 transition-all hover:bg-slate-50/80 ${
                    isSelected ? "bg-blue-50/40 border-l-4 border-blue-600" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      <Clock className="w-3 h-3" /> Step {task.step.step_number}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      {new Date(task.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{task.step.name}</h4>
                  
                  <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold">{task.assigned_role} Approval</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Details and Actions Workstation */}
      <div className={`flex-1 p-4 md:p-8 flex-col lg:flex-row gap-4 md:gap-8 overflow-y-auto ${!selectedTask ? 'hidden md:flex' : 'flex'}`}>
        {selectedTask ? (
          <>
            <div className="md:hidden mb-2">
              <button onClick={() => setSelectedTask(null)} className="flex items-center text-blue-600 font-semibold text-sm">
                <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back to Inbox
              </button>
            </div>
            {/* Task Details and Comments */}
            <div className="flex-1 space-y-4 md:space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4 md:space-y-5">
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Task Details</h2>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1">{selectedTask.step.name}</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Required Role</span>
                    <span className="font-semibold text-slate-700">{selectedTask.assigned_role}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Created At</span>
                    <span className="font-semibold text-slate-700">{new Date(selectedTask.created_at).toLocaleString()}</span>
                  </div>
                  {selectedTask.step.condition_expression && (
                    <div className="col-span-2">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Route Condition Rule</span>
                      <code className="text-xs bg-slate-50 border border-slate-100 rounded px-2 py-0.5 mt-1 text-slate-600 block w-fit">
                        {selectedTask.step.condition_expression}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {/* Action commentary block */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-400" />
                  <h3 className="text-base font-bold text-slate-900">Add Approval Comments</h3>
                </div>
                
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter custom comments or rejection remarks here..."
                  className="w-full min-h-[100px] p-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    disabled={actioning}
                    onClick={() => handleAction('REJECTED')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 rounded-xl transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Request
                  </button>
                  
                  <button
                    disabled={actioning}
                    onClick={() => handleAction('APPROVED')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/10"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Request
                  </button>
                </div>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="w-full lg:w-80 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 flex flex-col gap-4 md:gap-5 h-fit mt-4 lg:mt-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                <h3 className="text-base font-bold text-slate-900">Workflow Progress</h3>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No workflow timeline loaded.</p>
              ) : (
                <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-6">
                  {history.map((log, idx) => (
                    <div key={log.id || idx} className="relative">
                      {/* Bullet Dot */}
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white ring-4 ring-blue-50" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">
                            {log.transition_to.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {log.comments && (
                          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5 italic mt-1">
                            "{log.comments}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Select an Item</h3>
              <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                Choose an approval task from the sidebar list to review its details and action workflow transitions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowInbox;
