import React, { useState, useEffect } from 'react';
import { Drawer, Typography, Badge, Spin } from 'antd';
import { Activity, X, Info, AlertTriangle, CheckCircle, Flame } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { get } from "../api";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface ActivityEventData {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  severity: string;
  actor_id: string | null;
  description: string;
  created_at: string;
}

interface GlobalActivityFeedProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalActivityFeed({ isOpen, onClose }: GlobalActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityEventData[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial Fetch
  useEffect(() => {
    if (isOpen && activities.length === 0) {
      const fetchHistory = async () => {
        setLoading(true);
        try {
          const res = await get('/activity/?limit=30');
          setActivities(res.data);
        } catch (error) {
          console.error("Failed to load activity feed", error);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen]);

  // Listen to WebSocket broadcasts
  useEffect(() => {
    const handleNewActivity = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newActivity = customEvent.detail as ActivityEventData;
      setActivities(prev => [newActivity, ...prev].slice(0, 100)); // Keep max 100 in memory
    };

    window.addEventListener('NEW_ACTIVITY', handleNewActivity);
    return () => window.removeEventListener('NEW_ACTIVITY', handleNewActivity);
  }, []);

  const getIconForSeverity = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <Flame className="w-4 h-4 text-rose-500" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'SUCCESS': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBadgeColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'WARNING': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'SUCCESS': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      default: return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          <span className="font-extrabold text-slate-900 tracking-tight">Live Operations Feed</span>
          <Badge status="processing" color="indigo" />
        </div>
      }
      placement="right"
      width={420}
      onClose={onClose}
      open={isOpen}
      closeIcon={<X className="w-5 h-5 text-slate-400 hover:text-slate-900 transition-colors" />}
      styles={{
        header: { borderBottom: '1px solid #f1f5f9', padding: '16px 24px', backgroundColor: '#fff' },
        body: { padding: '0', backgroundColor: '#f8fafc' },
      }}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
          <Text type="secondary" className="text-xs font-semibold uppercase tracking-wider">Company Pulse</Text>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            REALTIME
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-10">
              <Text type="secondary" className="text-sm">No activity recorded yet.</Text>
            </div>
          ) : (
            activities.map((act) => (
              <div 
                key={act.id} 
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
              >
                {/* Left severity indicator bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  act.severity === 'CRITICAL' ? 'bg-rose-500' :
                  act.severity === 'WARNING' ? 'bg-amber-500' :
                  act.severity === 'SUCCESS' ? 'bg-emerald-500' : 'bg-blue-500'
                }`} />

                <div className="flex items-start justify-between gap-3 ml-1">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {getIconForSeverity(act.severity)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getBadgeColor(act.severity)}`}>
                          {act.action}
                        </span>
                        <Text type="secondary" className="text-[10px] font-semibold">
                          {act.entity_type.replace('_', ' ')}
                        </Text>
                      </div>
                      <p className="text-sm text-slate-800 font-medium leading-snug">
                        {act.description}
                      </p>
                      <Text type="secondary" className="text-xs mt-1.5 block">
                        {dayjs(act.created_at).fromNow()} {act.actor_id && `• By ${act.actor_id}`}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Drawer>
  );
}
