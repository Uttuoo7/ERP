import React from 'react';
import { Activity, Clock } from 'lucide-react';

export function ActivityFeed() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            Enterprise Activity Feed
          </h1>
          <p className="text-slate-500 mt-1">Universal audit log and activity stream.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No Activity Logged</h3>
          <p className="text-sm mt-1">Actions performed across the ERP will appear here in real-time.</p>
        </div>
      </div>
    </div>
  );
}
