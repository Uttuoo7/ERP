import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';

export interface KPICardData {
  title: string;
  value: string | number;
  prefix?: React.ReactNode;
  suffix?: string;
  valueColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

interface KPIHeaderCardsProps {
  metrics: KPICardData[];
}

export function KPIHeaderCards({ metrics }: KPIHeaderCardsProps) {
  return (
    <div className="mb-6">
      <Row gutter={[16, 16]}>
        {metrics.map((metric, idx) => (
          <Col xs={24} sm={12} md={6} key={idx}>
            <Card className="shadow-sm border-slate-100 hover:shadow-md transition-shadow h-full rounded-2xl">
              <Statistic
                title={<span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{metric.title}</span>}
                value={metric.value}
                prefix={metric.prefix}
                suffix={metric.suffix}
                valueStyle={{ 
                  color: metric.valueColor || '#0f172a',
                  fontWeight: 800,
                  fontSize: '1.75rem',
                  letterSpacing: '-0.025em'
                }}
              />
              {metric.trend && (
                <div className={`text-xs mt-2 font-medium ${
                  metric.trend === 'up' ? 'text-emerald-600' : 
                  metric.trend === 'down' ? 'text-rose-600' : 'text-slate-400'
                }`}>
                  {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'} {metric.trendValue}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
