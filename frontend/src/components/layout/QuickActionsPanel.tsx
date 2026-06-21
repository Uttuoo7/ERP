import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, ShoppingBag, ClipboardList, Warehouse, Play, FileText, ChevronRight, ChevronLeft
} from 'lucide-react';

export default function QuickActionsPanel() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);

  const actions = [
    {
      label: "Create Purchase Order",
      icon: <ShoppingBag className="w-4 h-4 text-blue-600" />,
      path: "/pos/convert",
      description: "Convert RFQ or create new PO"
    },
    {
      label: "Create Work Order",
      icon: <ClipboardList className="w-4 h-4 text-emerald-600" />,
      path: "/manufacturing/work-orders",
      description: "Launch new assembly order"
    },
    {
      label: "Receive Inventory",
      icon: <Warehouse className="w-4 h-4 text-amber-600" />,
      path: "/receive-goods",
      description: "Log GRN dock receipts"
    },
    {
      label: "Start Production",
      icon: <Play className="w-4 h-4 text-rose-600" />,
      path: "/manufacturing/shop-floor",
      description: "Record active shop floor tasks"
    },
    {
      label: "Run APS Optimizer",
      icon: <Zap className="w-4 h-4 text-indigo-600 animate-pulse" />,
      path: "/manufacturing/optimizer",
      description: "Finite scheduling simulation"
    },
    {
      label: "Create Invoice",
      icon: <FileText className="w-4 h-4 text-violet-600" />,
      path: "/invoices/new",
      description: "Submit vendor billing record"
    }
  ];

  const handleAction = (path: string) => {
    navigate(path);
    // Auto collapse panel on action selection for cleaner navigation experience
    setCollapsed(true);
  };

  return (
    <div 
      className={`fixed right-0 top-1/2 -translate-y-1/2 z-[90] flex items-center transition-all duration-300 font-sans ${
        collapsed ? 'translate-x-[280px]' : 'translate-x-0'
      }`}
    >
      {/* Toggle Tab Trigger button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="pr-2 pl-3 py-3 bg-slate-900 border-l border-t border-b border-slate-700 text-slate-200 hover:text-white rounded-l-2xl shadow-xl flex flex-col items-center gap-1 hover:bg-slate-800 transition-colors shrink-0"
        title={collapsed ? "Expand Quick Actions" : "Collapse Panel"}
      >
        <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-widest writing-mode-vertical text-slate-400">
          {collapsed ? "Actions" : "Close"}
        </span>
        {collapsed ? <ChevronLeft className="w-3.5 h-3.5 mt-1 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 mt-1 text-slate-400" />}
      </button>

      {/* Docked Actions panel content */}
      <div className="w-[280px] bg-slate-900 border-l border-slate-700 p-4 shadow-2xl flex flex-col gap-3.5 shrink-0 text-slate-200">
        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Persistent Actions
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {actions.map((act, idx) => (
            <button
              key={idx}
              onClick={() => handleAction(act.path)}
              className="group w-full p-2.5 bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-start gap-3 transition-all text-left"
            >
              <div className="p-2 bg-slate-900/60 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                {act.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                  {act.label}
                </div>
                <div className="text-[9px] text-slate-500 font-semibold truncate mt-0.5">
                  {act.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button 
          onClick={() => handleAction("/wizards")}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider text-center transition-colors shadow-lg shadow-blue-600/20"
        >
          Open Workflow Wizards
        </button>
      </div>
      
      <style>{`
        .writing-mode-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
}
