import React, { useEffect, useState } from 'react';
import { 
  Clock, User, ChevronDown, ChevronUp, Database, AlertCircle, Info, CheckCircle
} from 'lucide-react';
import { get } from '../../api';
import toast from 'react-hot-toast';

interface ActivityItem {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  severity: string;
  actor_id: string;
  description: string;
  metadata: any;
  created_at: string;
}

export default function ActivityTimeline({ limit = 10 }: { limit?: number }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await get(`/activity/?limit=${limit}`);
      setActivities(res.data || []);
    } catch (err) {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [limit]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // Helper to get severity style
  const getSeverityStyles = (severity: string) => {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL' || s === 'ERROR' || s === 'HIGH') {
      return {
        bg: 'bg-rose-50 text-rose-600 border-rose-100',
        dot: 'bg-rose-500 ring-rose-100',
        icon: <AlertCircle className="w-3.5 h-3.5" />
      };
    }
    if (s === 'WARNING' || s === 'MEDIUM') {
      return {
        bg: 'bg-amber-50 text-amber-600 border-amber-100',
        dot: 'bg-amber-500 ring-amber-100',
        icon: <AlertCircle className="w-3.5 h-3.5" />
      };
    }
    if (s === 'SUCCESS') {
      return {
        bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        dot: 'bg-emerald-500 ring-emerald-100',
        icon: <CheckCircle className="w-3.5 h-3.5" />
      };
    }
    return {
      bg: 'bg-blue-50 text-blue-600 border-blue-100',
      dot: 'bg-blue-500 ring-blue-100',
      icon: <Info className="w-3.5 h-3.5" />
    };
  };

  // Format date to relative string
  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" /> Operational Activity Logs
        </h3>
        <button 
          onClick={fetchActivities}
          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
        >
          Refresh Feed
        </button>
      </div>

      {loading && activities.length === 0 ? (
        <div className="py-10 text-center text-xs font-semibold text-slate-400">
          Loading audit trail...
        </div>
      ) : activities.length === 0 ? (
        <div className="py-10 text-center text-xs font-semibold text-slate-400">
          No audit logs recorded in current session.
        </div>
      ) : (
        <div className="relative border-l border-slate-200 ml-3 pl-6 space-y-5 py-2">
          {activities.map((item) => {
            const styles = getSeverityStyles(item.severity);
            const isExpanded = expandedId === item.id;

            return (
              <div key={item.id} className="relative group text-xs font-semibold">
                {/* Timeline Dot Indicator */}
                <span className={`absolute -left-[30px] top-1 rounded-full w-4 h-4 flex items-center justify-center ring-4 ring-white ${styles.bg}`}>
                  {styles.icon}
                </span>

                <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs space-y-1.5 transition-all hover:border-slate-300">
                  {/* Header info */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="text-slate-800 font-extrabold leading-tight">{item.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                          {item.entity_type}
                        </span>
                        <span className="flex items-center gap-0.5 font-bold">
                          <User className="w-3 h-3 text-slate-350" /> System Actor
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider shrink-0 mt-0.5">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>

                  {/* Metadata toggles */}
                  {item.metadata && Object.keys(item.metadata).length > 0 && (
                    <div className="border-t border-slate-50 pt-2 mt-2">
                      <button 
                        onClick={() => toggleExpand(item.id)}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" /> Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" /> View Metadata Trace
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-mono text-slate-600 overflow-x-auto max-w-full">
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
