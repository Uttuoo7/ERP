import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Button, Badge, Space, Spin } from 'antd';
import { BrainCircuit, AlertTriangle, TrendingUp, CheckCircle, Flame, Server, ShieldAlert } from 'lucide-react';
import { get, post } from "../api";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

export function RecommendationDashboard() {
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecs = async () => {
    setLoading(true);
    try {
      const res = await get('/intelligence/recommendations');
      setRecs(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecs();

    const handleNewActivity = () => {
      fetchRecs();
    };
    window.addEventListener('NEW_ACTIVITY', handleNewActivity);
    return () => window.removeEventListener('NEW_ACTIVITY', handleNewActivity);
  }, []);

  const triggerAnalysis = async () => {
    await post('/intelligence/trigger-analysis', {});
    setTimeout(fetchRecs, 1000);
  };

  const resolveRec = async (id: str) => {
    await post(`/intelligence/recommendations/${id}/resolve`, {});
    fetchRecs();
  };

  const getIcon = (module: string) => {
    switch (module) {
      case 'PROCUREMENT': return <TrendingUp className="w-5 h-5 text-indigo-500" />;
      case 'INVENTORY': return <Server className="w-5 h-5 text-emerald-500" />;
      case 'FINANCE': return <ShieldAlert className="w-5 h-5 text-amber-500" />;
      case 'WORKFLOW': return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default: return <BrainCircuit className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <Badge color="red" text="CRITICAL" />;
      case 'WARNING': return <Badge color="orange" text="WARNING" />;
      case 'OPPORTUNITY': return <Badge color="green" text="OPPORTUNITY" />;
      default: return <Badge color="blue" text="INFO" />;
    }
  };

  return (
    <div className="erp-content space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="m-0 flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
            Intelligence Center
          </Title>
          <Text type="secondary">AI-driven operational anomalies and proactive recommendations.</Text>
        </div>
        <Button type="primary" onClick={triggerAnalysis} className="erp-btn erp-btn-primary">
          Run Analysis Job
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Spin size="large" /></div>
      ) : recs.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-slate-200">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <Title level={4}>All Clear!</Title>
          <Text type="secondary">No outstanding risks or recommendations at this time.</Text>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {recs.map((rec) => (
            <Col xs={24} md={12} lg={8} key={rec.id}>
              <Card 
                className={`h-full flex flex-col hover:shadow-md transition-shadow border-t-4 ${
                  rec.severity === 'CRITICAL' ? 'border-t-rose-500' :
                  rec.severity === 'WARNING' ? 'border-t-amber-500' :
                  rec.severity === 'OPPORTUNITY' ? 'border-t-emerald-500' : 'border-t-blue-500'
                }`}
                bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {getIcon(rec.module)}
                    <Text strong className="text-xs tracking-wider text-slate-500">{rec.module}</Text>
                  </div>
                  {getSeverityBadge(rec.severity)}
                </div>
                
                <Title level={5} className="mb-2 leading-tight">{rec.title}</Title>
                <Text type="secondary" className="mb-4 flex-1">{rec.description}</Text>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                  <Text type="secondary" className="text-xs">{dayjs(rec.created_at).fromNow()}</Text>
                  <Space>
                    {rec.action_payload && (
                      <Button size="small" type="primary" className="bg-indigo-600">
                        {rec.action_payload.action.replace(/_/g, ' ')}
                      </Button>
                    )}
                    <Button size="small" onClick={() => resolveRec(rec.id)}>Dismiss</Button>
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
