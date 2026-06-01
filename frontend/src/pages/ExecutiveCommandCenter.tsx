import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Spin, Progress, Statistic, Tag, Button } from 'antd';
import { BrainCircuit, ShieldAlert, ArrowUpRight, Clock, Activity, FileWarning, BarChart4 } from 'lucide-react';
import { useAuthStore } from "../store/authStore";

const { Title, Text } = Typography;

export function ExecutiveCommandCenter() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/ai/executive-summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setSummary(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSummary();
  }, [token]);

  if (loading || !summary) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-slate-50">
        <Spin size="large" tip="AI Compiling Executive Summary..." />
      </div>
    );
  }

  const isOptimal = summary.health_score >= 80;
  const isWarning = summary.health_score < 80 && summary.health_score >= 50;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-4">
        <div>
          <Title level={2} className="m-0 text-slate-800 flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-indigo-600" />
            Executive Intelligence Command Center
          </Title>
          <Text className="text-slate-500 text-lg">AI-generated operational overview for the executive suite.</Text>
        </div>
        <Tag color="blue" className="text-sm px-3 py-1 rounded-full flex items-center gap-2">
          <Clock className="w-4 h-4" /> Updated just now
        </Tag>
      </div>

      <Row gutter={[24, 24]}>
        {/* Main Narrative Card */}
        <Col span={24} lg={16}>
          <Card className="h-full rounded-2xl shadow-sm border-slate-200 overflow-hidden" bodyStyle={{ padding: 0 }}>
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-8 text-white h-full flex flex-col justify-between relative overflow-hidden">
              <BrainCircuit className="absolute -right-10 -bottom-10 w-64 h-64 text-white opacity-5" />
              
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <div className={`w-3 h-3 rounded-full ${isOptimal ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-rose-400'} animate-pulse`}></div>
                  <Text className="text-slate-300 font-semibold tracking-widest text-xs uppercase">Live AI Operational Brief</Text>
                </div>
                
                <Title level={3} className="text-white m-0 font-light leading-relaxed">
                  "{summary.executive_narrative}"
                </Title>
              </div>
              
              <div className="mt-12 flex gap-4">
                <Button ghost className="border-slate-500 text-slate-300 hover:text-white hover:border-white">
                  Investigate Anomalies
                </Button>
                <Button type="primary" className="bg-indigo-600 hover:bg-indigo-500 border-none">
                  Open AI Assistant
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        {/* Health Score Card */}
        <Col span={24} lg={8}>
          <Card className="h-full rounded-2xl shadow-sm border-slate-200 flex flex-col justify-center items-center text-center p-6">
            <Text className="text-slate-500 font-semibold tracking-widest text-xs uppercase block mb-4">Overall System Health</Text>
            <Progress 
              type="dashboard" 
              percent={summary.health_score} 
              strokeColor={isOptimal ? '#10b981' : isWarning ? '#f59e0b' : '#ef4444'}
              format={percent => <span className="text-4xl font-bold text-slate-800">{percent}</span>}
              size={180}
            />
            <Title level={4} className={`mt-4 m-0 ${isOptimal ? 'text-emerald-600' : isWarning ? 'text-amber-600' : 'text-rose-600'}`}>
              {summary.status_text}
            </Title>
            <Text className="text-slate-400 text-xs mt-2">Based on Realtime Database Metrics</Text>
          </Card>
        </Col>

        {/* Quick Stats */}
        <Col span={24} md={8}>
          <Card className="rounded-2xl shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <Statistic 
              title={<span className="flex items-center gap-2 text-slate-500"><FileWarning className="w-4 h-4" /> Pending POs</span>}
              value={summary.metrics.draft_pos}
              valueStyle={{ color: '#1e293b', fontWeight: 'bold', fontSize: '32px' }}
            />
          </Card>
        </Col>
        
        <Col span={24} md={8}>
          <Card className="rounded-2xl shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <Statistic 
              title={<span className="flex items-center gap-2 text-slate-500"><Clock className="w-4 h-4" /> Approvals Bottlenecked</span>}
              value={summary.metrics.pending_approvals}
              valueStyle={{ color: summary.metrics.pending_approvals > 5 ? '#ef4444' : '#1e293b', fontWeight: 'bold', fontSize: '32px' }}
              suffix={summary.metrics.pending_approvals > 5 ? <ArrowUpRight className="w-6 h-6 text-rose-500 ml-2" /> : null}
            />
          </Card>
        </Col>
        
        <Col span={24} md={8}>
          <Card className="rounded-2xl shadow-sm border-slate-200 hover:shadow-md transition-shadow bg-rose-50 border-rose-100">
            <Statistic 
              title={<span className="flex items-center gap-2 text-rose-600 font-bold"><ShieldAlert className="w-4 h-4" /> Active Anomalies</span>}
              value={summary.metrics.active_anomalies}
              valueStyle={{ color: '#e11d48', fontWeight: 'bold', fontSize: '32px' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
