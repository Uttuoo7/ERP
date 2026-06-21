import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { getUnreadNotificationsCount } from "../api";

const NotificationDropdown: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const setNotificationCenterOpen = useUIStore(state => state.setNotificationCenterOpen);

  const fetchUnreadStats = async () => {
    try {
      const countRes = await getUnreadNotificationsCount();
      setUnreadCount(countRes.data.count);
    } catch (err) {
      // Ignored
    }
  };

  useEffect(() => {
    fetchUnreadStats();

    const handleNewNotification = () => {
      setUnreadCount(prev => prev + 1);
    };

    const handleNotificationsRead = () => {
      fetchUnreadStats();
    };

    window.addEventListener('NEW_NOTIFICATION', handleNewNotification);
    window.addEventListener('NOTIFICATIONS_READ_ALL', handleNotificationsRead);
    window.addEventListener('NOTIFICATION_READ_ONE', handleNotificationsRead);
    return () => {
      window.removeEventListener('NEW_NOTIFICATION', handleNewNotification);
      window.removeEventListener('NOTIFICATIONS_READ_ALL', handleNotificationsRead);
      window.removeEventListener('NOTIFICATION_READ_ONE', handleNotificationsRead);
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setNotificationCenterOpen(true)}
        className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 text-slate-500 hover:text-slate-800"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow shadow-rose-600/25 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationDropdown;
