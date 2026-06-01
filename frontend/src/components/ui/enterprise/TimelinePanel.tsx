import React from 'react';
import { Card, Typography, Spin } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export interface TimelineEvent {
  id: string;
  title: string;
  timestamp: string;
  description?: string;
  actor?: string;
  statusColor?: string;
}

interface TimelinePanelProps {
  events: TimelineEvent[];
  loading?: boolean;
}

export function TimelinePanel({ events, loading = false }: TimelinePanelProps) {
  return (
    <Card 
      className="shadow-sm border-slate-100 rounded-2xl sticky top-24"
      styles={{ body: { padding: '24px 20px' } }}
    >
      <div className="flex items-center gap-2 mb-6">
        <HistoryOutlined className="text-slate-400 text-lg" />
        <Title level={5} style={{ margin: 0 }} className="text-slate-900 font-bold">Activity Timeline</Title>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : events.length === 0 ? (
        <Text type="secondary" className="block text-center py-6 text-xs">No activity recorded yet.</Text>
      ) : (
        <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-6">
          {events.map((event, idx) => (
            <div key={event.id || idx} className="relative">
              {/* Bullet Dot */}
              <span 
                className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-4 ring-slate-50"
                style={{ backgroundColor: event.statusColor || '#4f46e5' }}
              />
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{event.title}</span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {dayjs(event.timestamp).format('HH:mm')}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {dayjs(event.timestamp).format('DD MMM YYYY')}
                </div>
                {event.actor && (
                  <Text className="text-xs text-slate-500 block">By: {event.actor}</Text>
                )}
                {event.description && (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5 italic mt-2">
                    "{event.description}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
