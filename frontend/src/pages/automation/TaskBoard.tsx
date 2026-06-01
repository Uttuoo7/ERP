import React, { useState } from 'react';
import { CheckSquare, List, Calendar, LayoutGrid } from 'lucide-react';

export function TaskBoard() {
  const [view, setView] = useState<'KANBAN' | 'LIST'>('KANBAN');
  const columns = ['OPEN', 'IN_PROGRESS', 'HOLD', 'COMPLETED'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-indigo-600" />
            Operational Task Board
          </h1>
          <p className="text-slate-500 mt-1">Manage assigned work, approvals, and escalations.</p>
        </div>
        <div className="flex bg-white rounded-lg border border-slate-200 p-1">
          <button 
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'KANBAN' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setView('KANBAN')}
          >
            <LayoutGrid className="w-4 h-4" /> Board
          </button>
          <button 
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'LIST' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setView('LIST')}
          >
            <List className="w-4 h-4" /> List
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[600px]">
        {columns.map(col => (
          <div key={col} className="bg-slate-50 border border-slate-200 rounded-2xl min-w-[320px] flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
              {col.replace('_', ' ')}
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">0</span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              <div className="text-center p-4 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                No tasks
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
