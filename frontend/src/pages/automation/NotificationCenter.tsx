import React from 'react';
import { Bell, CheckCircle, Clock } from 'lucide-react';
import { useWebSocket } from '../../components/layout/WebSocketProvider';

export function NotificationCenter() {
  const { notifications, clearNotification } = useWebSocket();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-600" />
            Notification Center
          </h1>
          <p className="text-slate-500 mt-1">Real-time enterprise alerts and approval requests.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex flex-col">
        {notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Bell className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="font-bold text-slate-700 text-lg">You're all caught up!</h3>
            <p className="text-sm mt-1">No new notifications.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.map(n => (
              <div key={n.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex gap-4">
                <div className={`p-2 rounded-full h-10 w-10 flex items-center justify-center ${n.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800">{n.title}</h4>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                  <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                <button 
                  onClick={() => clearNotification(n.id)}
                  className="text-slate-400 hover:text-emerald-600 transition"
                >
                  <CheckCircle className="w-6 h-6" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
