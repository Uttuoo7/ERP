import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, CheckCircle2, AlertTriangle, Info, XCircle, Loader2, MailOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getNotifications, getUnreadNotificationsCount, markAllNotificationsRead, markNotificationRead } from '../api';

const NotificationDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadStats = async () => {
    try {
      const countRes = await getUnreadNotificationsCount();
      setUnreadCount(countRes.data.count);
    } catch (err) {
      // Ignored during passive polling
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getNotifications(false); // fetch all notifications
      setNotifications(res.data.slice(0, 5)); // show latest 5
    } catch (err) {
      toast.error("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadStats();
    // Poll unread counts every 15 seconds
    const interval = setInterval(fetchUnreadStats, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      fetchList();
    }
  }, [open]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      fetchList();
      toast.success("All notifications marked as read.");
    } catch (err) {
      // Handled
    }
  };

  const handleMarkOneRead = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      fetchUnreadStats();
      fetchList();
    } catch (err) {
      // Handled
    }
  };

  return (
    <div className="relative text-slate-700 font-semibold text-xs" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 text-slate-500 hover:text-slate-800"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow shadow-rose-600/25 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 py-1">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">In-App Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-[10px] text-slate-400">Loading alerts...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <MailOpen className="w-8 h-8 mx-auto text-slate-300" />
                <span className="block text-[10px]">No new notifications</span>
              </div>
            ) : (
              notifications.map((item) => {
                const Icon = 
                  item.type === 'SUCCESS' ? CheckCircle2 :
                  item.type === 'CRITICAL' || item.type === 'ERROR' ? XCircle :
                  item.type === 'WARNING' ? AlertTriangle : Info;

                const colorClasses = 
                  item.type === 'SUCCESS' ? 'text-emerald-600 bg-emerald-50/50' :
                  item.type === 'CRITICAL' || item.type === 'ERROR' ? 'text-rose-600 bg-rose-50/50 animate-pulse' :
                  item.type === 'WARNING' ? 'text-amber-600 bg-amber-50/50' : 'text-blue-600 bg-blue-50/50';

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 hover:bg-slate-50 transition-colors flex gap-3 relative ${
                      !item.is_read ? 'bg-slate-50/30' : ''
                    }`}
                  >
                    <div className={`p-2 rounded-xl h-9 w-9 shrink-0 flex items-center justify-center ${colorClasses}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-extrabold text-slate-900 leading-tight block truncate">{item.title}</span>
                        {!item.is_read && (
                          <button
                            onClick={(e) => handleMarkOneRead(e, item.id)}
                            className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1"
                            title="Mark read"
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed break-words">{item.message}</p>
                      <span className="text-[8px] text-slate-350 font-bold block">{new Date(item.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-50 px-4 py-2 text-center bg-slate-50/50">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-[10px] font-black text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider block"
            >
              Open Notification Center
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
