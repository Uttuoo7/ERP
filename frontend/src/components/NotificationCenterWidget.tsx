import React, { useEffect, useState, useRef } from 'react';
import { 
  X, Bell, AlertTriangle, Info, CheckCircle2, Trash2, CheckSquare, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUIStore } from '../store/uiStore';
import { 
  getNotifications, markAllNotificationsRead, markNotificationRead, getUnreadNotificationsCount 
} from '../api';

export default function NotificationCenterWidget() {
  const isOpen = useUIStore(state => state.notificationCenterOpen);
  const setIsOpen = useUIStore(state => state.setNotificationCenterOpen);

  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const widgetRef = useRef<HTMLDivElement>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getNotifications(false);
      setNotifications(res.data || []);
    } catch (err) {
      toast.error("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchList();
      requestAnimationFrame(() => widgetRef.current?.focus());
    }
  }, [isOpen]);

  // Handle outside click or escape key to close
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (isOpen && widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      // Dispatch event to sync other widgets
      window.dispatchEvent(new CustomEvent('NOTIFICATIONS_READ_ALL'));
      toast.success("All alerts marked as read.");
    } catch (err) {
      // Handled
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      window.dispatchEvent(new CustomEvent('NOTIFICATION_READ_ONE', { detail: id }));
    } catch (err) {
      // Handled
    }
  };

  if (!isOpen) return null;

  // Group notifications by type
  const critical = notifications.filter(n => n.type === 'CRITICAL' || n.type === 'ERROR');
  const warning = notifications.filter(n => n.type === 'WARNING');
  const info = notifications.filter(n => n.type === 'INFO' || n.type === 'SUCCESS');

  return (
    <div className="fixed inset-0 z-[999] flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in font-sans">
      <div 
        ref={widgetRef}
        tabIndex={-1}
        className="w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col focus:outline-none animate-slide-in-right"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Operational Alerts</h2>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Real-time system exceptions & tasks</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        {notifications.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-100/50 border-b border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {notifications.filter(n => !n.is_read).length} Unread
            </span>
            <button 
              onClick={handleMarkAllRead}
              className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold uppercase tracking-wider"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Mark All Read
            </button>
          </div>
        )}

        {/* Alerts Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
              <span className="text-xs text-slate-400 font-semibold">Loading system feed...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
              <Bell className="w-10 h-10 text-slate-200" />
              <div className="text-xs font-black text-slate-700 uppercase tracking-wider">All Clear!</div>
              <p className="text-[10px] text-slate-400 font-semibold max-w-[200px]">
                No pending alerts or exceptions require your attention.
              </p>
            </div>
          ) : (
            <>
              {/* Critical Alerts */}
              {critical.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" /> Critical Action Required ({critical.length})
                  </h3>
                  <div className="space-y-2">
                    {critical.map(item => <AlertItem key={item.id} item={item} onMarkRead={handleMarkOneRead} />)}
                  </div>
                </div>
              )}

              {/* Warning Alerts */}
              {warning.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Warnings ({warning.length})
                  </h3>
                  <div className="space-y-2">
                    {warning.map(item => <AlertItem key={item.id} item={item} onMarkRead={handleMarkOneRead} />)}
                  </div>
                </div>
              )}

              {/* Info & Success Alerts */}
              {info.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Information ({info.length})
                  </h3>
                  <div className="space-y-2">
                    {info.map(item => <AlertItem key={item.id} item={item} onMarkRead={handleMarkOneRead} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .animate-fade-in {
          animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function AlertItem({ item, onMarkRead }: { item: any; onMarkRead: (id: string) => void }) {
  const Icon = 
    item.type === 'SUCCESS' ? CheckCircle2 :
    item.type === 'CRITICAL' || item.type === 'ERROR' ? XCircleIcon :
    item.type === 'WARNING' ? AlertTriangle : Info;

  const typeStyles = 
    item.type === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
    item.type === 'CRITICAL' || item.type === 'ERROR' ? 'bg-rose-50 text-rose-600 border-rose-100' :
    item.type === 'WARNING' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100';

  return (
    <div className={`p-3.5 rounded-xl border flex gap-3 relative transition-all hover:shadow-sm ${typeStyles} ${item.is_read ? 'opacity-65 grayscale-[30%]' : ''}`}>
      <div className="shrink-0 mt-0.5">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex justify-between items-start gap-2">
          <span className="text-xs font-black text-slate-800 leading-tight block">{item.title}</span>
          {!item.is_read && (
            <button 
              onClick={() => onMarkRead(item.id)}
              className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider shrink-0"
            >
              Acknowledge
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-600 font-semibold leading-relaxed break-words">{item.message}</p>
        <span className="text-[8px] text-slate-400 font-bold block">
          {new Date(item.created_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// Custom simple error icon
function XCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
