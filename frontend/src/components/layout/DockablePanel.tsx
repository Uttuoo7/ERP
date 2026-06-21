import React, { useRef, useState, useEffect } from 'react';
import { useDockableStore } from '../../store/dockableStore';
import type { DockablePanelType } from '../../store/dockableStore';
import { useBackgroundJobStore } from '../../store/backgroundJobStore';
import NotificationCenterWidget from '../NotificationCenterWidget';
import { 
  X, Pin, Bell, Calendar, Bot, MessageSquare, Clock, CheckSquare, Send, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWorkflowInbox } from '../../api';

export function DockablePanel() {
  const { activePanel, isOpen, isPinned, width, closePanel, togglePin, setWidth } = useDockableStore();
  const containerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !activePanel) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startX = e.clientX;
    const startWidth = width;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      // Panel is on the right, so dragging left increases width, dragging right decreases width
      const deltaX = moveEvent.clientX - startX;
      setWidth(startWidth - deltaX);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const getTitle = () => {
    switch (activePanel) {
      case 'notifications': return 'System Alerts';
      case 'workflow': return 'Workflow Inbox';
      case 'calendar': return 'Operations Calendar';
      case 'ai-assistant': return 'Apex AI Copilot';
      case 'chat': return 'Team Collaboration';
      case 'recents': return 'Recent Activity Logs';
      default: return 'Utility Panel';
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px` }}
      className={`h-full bg-white border-l border-slate-200 flex flex-row shrink-0 relative overflow-hidden select-none font-sans ${
        isPinned ? '' : 'fixed right-0 top-16 h-[calc(100vh-64px)] z-40 shadow-2xl animate-slide-in-right'
      }`}
    >
      {/* Resizer Handle (Left Border) */}
      <div
        onPointerDown={handlePointerDown}
        className="w-1.5 h-full hover:bg-blue-500 active:bg-blue-600 transition-colors cursor-col-resize shrink-0 flex items-center justify-center"
      >
        <div className="w-0.5 h-6 bg-slate-300 rounded" />
      </div>

      {/* Panel Content area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
            {activePanel === 'notifications' && <Bell className="w-4 h-4 text-blue-500" />}
            {activePanel === 'workflow' && <CheckSquare className="w-4 h-4 text-emerald-500" />}
            {activePanel === 'calendar' && <Calendar className="w-4 h-4 text-amber-500" />}
            {activePanel === 'ai-assistant' && <Bot className="w-4 h-4 text-indigo-500" />}
            {activePanel === 'chat' && <MessageSquare className="w-4 h-4 text-violet-500" />}
            {activePanel === 'recents' && <Clock className="w-4 h-4 text-slate-500" />}
            {getTitle()}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={togglePin}
              className={`p-1 hover:bg-slate-200 rounded transition-colors ${isPinned ? 'text-blue-500' : 'text-slate-400'}`}
              title={isPinned ? 'Unpin Panel' : 'Pin Panel (Split Screen Layout)'}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </button>
            <button
              onClick={closePanel}
              className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body Viewport */}
        <div className="flex-1 overflow-y-auto p-4 select-text">
          {activePanel === 'notifications' && <NotificationsFeed />}
          {activePanel === 'workflow' && <WorkflowInboxFeed />}
          {activePanel === 'calendar' && <CalendarWidget />}
          {activePanel === 'ai-assistant' && <AIAssistantChat />}
          {activePanel === 'chat' && <CollaborationChat />}
          {activePanel === 'recents' && <RecentLogsFeed />}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-views ─────────────────────────────────────────────────────────────

function NotificationsFeed() {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Generate realistic alerts
    setAlerts([
      { id: '1', title: 'Low Stock SKU-882 (Raw Steel Sheet)', desc: '1.2 tons remaining, reorder threshold is 2.0 tons', time: '10m ago', type: 'warning' },
      { id: '2', title: 'QC Defect Supreme Steel Sheets', desc: 'Thickness check failed on Batch #SS2026', time: '1h ago', type: 'error' },
      { id: '3', title: 'Payment Voucher PV-2026-902 Approved', desc: 'Released for payment by G/L accounting', time: '3h ago', type: 'success' },
      { id: '4', title: 'Tally Bridge sync successfully', desc: '35 AP ledger accounts synced', time: '5h ago', type: 'info' }
    ]);
  }, []);

  return (
    <div className="space-y-3 font-sans text-xs">
      {alerts.map((al) => (
        <div key={al.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <div className="flex justify-between items-center">
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
              al.type === 'error' ? 'bg-rose-100 text-rose-800' :
              al.type === 'warning' ? 'bg-amber-100 text-amber-800' :
              al.type === 'success' ? 'bg-emerald-100 text-emerald-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {al.type}
            </span>
            <span className="text-[9px] text-slate-400 font-semibold">{al.time}</span>
          </div>
          <h4 className="font-extrabold text-slate-800">{al.title}</h4>
          <p className="text-slate-500 font-medium leading-relaxed">{al.desc}</p>
        </div>
      ))}
    </div>
  );
}

function WorkflowInboxFeed() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkflowInbox()
      .then(res => {
        setWorkflows(res.data || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center text-slate-400 py-6 text-xs font-semibold">Loading inbox...</div>;

  return (
    <div className="space-y-3 font-sans text-xs">
      {workflows.length === 0 ? (
        <div className="text-center text-slate-400 py-6 font-semibold">No pending approvals.</div>
      ) : (
        workflows.map((wf) => (
          <div key={wf.id} className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-sm space-y-2">
            <div className="flex justify-between">
              <span className="font-extrabold text-slate-800">PO Approval Requested</span>
              <span className="text-slate-500 font-bold">₹{wf.details?.amount || '0'}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              <div>Ref: {wf.details?.reference_number || 'PO-2026-XXX'}</div>
              <div>Vendor: {wf.details?.vendor_name || 'Vendor'}</div>
              <div>Initiated: {new Date(wf.created_at).toLocaleDateString()}</div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => toast.success('Approved PO.')}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black uppercase text-[8px] tracking-wider transition"
              >
                Approve
              </button>
              <button 
                onClick={() => toast.error('Rejected PO.')}
                className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-black uppercase text-[8px] tracking-wider transition"
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function CalendarWidget() {
  const events = [
    { id: 1, title: 'Main Vault Audit', date: 'June 22, 2026', time: '10:00 AM' },
    { id: 2, title: 'Supreme Steel Delivery', date: 'June 22, 2026', time: '02:00 PM' },
    { id: 3, title: 'Tally ERP Monthly closing', date: 'June 25, 2026', time: 'All Day' }
  ];

  return (
    <div className="space-y-4 font-sans text-xs">
      <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 text-center font-extrabold">
        {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: 'numeric' })}
      </div>
      <div className="space-y-2">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Upcoming Events</span>
        {events.map(ev => (
          <div key={ev.id} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center shadow-sm">
            <div>
              <h5 className="font-extrabold text-slate-800">{ev.title}</h5>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{ev.date} at {ev.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIAssistantChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', text: 'Hello! I am your Apex AI Executive. I can query ledger statuses, trace stock reorders, or audit vendor risks. Try: "vendor tata"' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      let reply = 'I have queried the P2P databases, but no matching audit exception was found. Can you refine your query?';
      if (input.toLowerCase().includes('tata')) {
        reply = 'Tata Steel Corp is flagged as [Low Risk] with 98.4% on-time delivery. Spends MTD: ₹12,45,000. 1 open PO pending GRN.';
      } else if (input.toLowerCase().includes('po')) {
        reply = 'There are currently 12 purchase orders pending approvals, with a total commitment of ₹45,50,000.';
      }
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col justify-between font-sans text-xs">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm leading-relaxed ${
              m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-50 border border-slate-100 rounded-tl-none text-slate-700'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-400 italic">Thinking...</div>}
      </div>
      
      <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI assistant..." 
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 text-xs shadow-sm bg-slate-50/50"
        />
        <button 
          onClick={handleSend}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function CollaborationChat() {
  const [messages, setMessages] = useState([
    { user: 'Sanjay (Inventory)', text: 'supreme Steel sheets received on dock WH-01.', time: '10m ago' },
    { user: 'Amit (Finance)', text: 'Thanks. Preparing voucher for AP upload.', time: '8m ago' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { user: 'Me', text: input, time: 'Just now' }]);
    setInput('');
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col justify-between font-sans text-xs">
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-[9px]">
              <span className="font-black text-slate-500">{m.user}</span>
              <span className="text-slate-400 font-semibold">{m.time}</span>
            </div>
            <p className="text-slate-700 leading-relaxed font-semibold">{m.text}</p>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Collaborate..." 
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 text-xs shadow-sm bg-slate-50/50"
        />
        <button 
          onClick={handleSend}
          className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-md transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RecentLogsFeed() {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    // Generate recent logs
    setActivities([
      { id: 1, action: 'User login verified', detail: 'Sanjay mapped to WAREHOUSE role', time: '10m ago' },
      { id: 2, action: 'PO-2026-001 created', detail: 'Created from RFQ-99021', time: '12m ago' },
      { id: 3, action: 'Stock valuation backup', detail: 'Created backup erp_v8.db.bak', time: '1h ago' }
    ]);
  }, []);

  return (
    <div className="space-y-3 font-sans text-xs">
      {activities.map(act => (
        <div key={act.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <div className="flex justify-between items-center text-[9px]">
            <span className="font-black text-slate-800">{act.action}</span>
            <span className="text-slate-400 font-semibold">{act.time}</span>
          </div>
          <p className="text-slate-500 leading-relaxed font-semibold">{act.detail}</p>
        </div>
      ))}
    </div>
  );
}
