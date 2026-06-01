import React from 'react';
import { GitMerge, Plus } from 'lucide-react';

export function WorkflowDesigner() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <GitMerge className="w-8 h-8 text-indigo-600" />
            Workflow Automation Designer
          </h1>
          <p className="text-slate-500 mt-1">Configure IF-THEN rules to automate ERP operations.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm">
          + New Rule
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <GitMerge className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No Automation Rules</h3>
          <p className="text-sm mt-1">Create a new workflow rule to start automating tasks and notifications.</p>
        </div>
      </div>
    </div>
  );
}
