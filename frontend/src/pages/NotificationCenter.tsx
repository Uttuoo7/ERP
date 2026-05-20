import React, { useState, useEffect } from 'react';
import { 
  Bell, MailOpen, Trash2, CheckCircle2, AlertTriangle, Info, XCircle, Loader2, Sparkles, Filter, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api';

const NotificationCenter: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getNotifications(unreadOnly);
      setNotifications(res.data);
    } catch (err) {
      toast.error("Failed to load notifications history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [unreadOnly]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      toast.success("All notification alerts marked as read.");
      fetchList();
    } catch (err) {
      // Handled
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      fetchList();
    } catch (err) {
      // Handled
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 bg-slate-50 min-h-screen text-xs font-semibold text-slate-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Notifications Center</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Real-time procurement alerts, approval blocks, quality failures, and liability postings</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100/50 border border-blue-100 text-blue-600 rounded-xl transition-all font-bold text-xs"
          >
            <Check className="w-4 h-4" />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Controls and Feed */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        {/* Toggle unread filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filter Feed</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnreadOnly(false)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                !unreadOnly ? 'bg-blue-600 border-blue-600 text-white shadow shadow-blue-600/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setUnreadOnly(true)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                unreadOnly ? 'bg-blue-600 border-blue-600 text-white shadow shadow-blue-600/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Unread Only
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-400 font-bold">Assembling alerts timeline...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <MailOpen className="w-12 h-12 mx-auto text-slate-300" />
            <span className="block font-bold">No active notification alerts inside your inbox</span>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => {
              const Icon = 
                item.type === 'SUCCESS' ? CheckCircle2 :
                item.type === 'CRITICAL' || item.type === 'ERROR' ? XCircle :
                item.type === 'WARNING' ? AlertTriangle : Info;

              const colorClasses = 
                item.type === 'SUCCESS' ? 'text-emerald-600 bg-emerald-50/50' :
                item.type === 'CRITICAL' || item.type === 'ERROR' ? 'text-rose-600 bg-rose-50/50' :
                item.type === 'WARNING' ? 'text-amber-600 bg-amber-50/50' : 'text-blue-600 bg-blue-50/50';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border border-slate-150 transition-colors flex gap-4 items-start ${
                    !item.is_read ? 'bg-slate-50/50 shadow-sm border-blue-100' : 'bg-white'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl h-10 w-10 shrink-0 flex items-center justify-center ${colorClasses}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-extrabold text-slate-905 block text-sm leading-none">{item.title}</span>
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed break-words mt-1">{item.message}</p>
                  </div>

                  {!item.is_read && (
                    <button
                      onClick={() => handleMarkOneRead(item.id)}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100/50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-black transition-all"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
