import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Tag, notification, Row, Col, Statistic } from 'antd';
import { HeartOutlined, AlertOutlined, ApiOutlined, FieldTimeOutlined } from '@ant-design/icons';
import { get } from "../api";
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const SystemHealthDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await get('/observability/alerts');
        setAlerts(res.data);
      } catch (error) {
        notification.error({ message: 'Failed to fetch system health alerts' });
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  const activeAlerts = alerts.filter(a => !a.is_resolved);

  const columns = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (val: string) => dayjs(val).format('DD MMM YYYY HH:mm') },
    { title: 'Type', dataIndex: 'alert_type', key: 'alert_type', render: (val: string) => <Text strong>{val}</Text> },
    { title: 'Severity', dataIndex: 'severity', key: 'severity', render: (val: string) => {
      if (val === 'CRITICAL') return <Tag color="error">{val}</Tag>;
      if (val === 'WARNING') return <Tag color="warning">{val}</Tag>;
      return <Tag color="blue">{val}</Tag>;
    }},
    { title: 'Message', dataIndex: 'message', key: 'message' },
    { title: 'Status', dataIndex: 'is_resolved', key: 'is_resolved', render: (val: boolean) => val ? <Tag color="success">Resolved</Tag> : <Tag color="error">Active</Tag> },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}><HeartOutlined /> System Health Overview</Title>
      <Text type="secondary">Real-time status of ERP APIs, Queues, and Integrations.</Text>

      <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic 
              title="System Status" 
              value={activeAlerts.length > 0 ? "Degraded" : "Healthy"} 
              valueStyle={{ color: activeAlerts.length > 0 ? '#cf1322' : '#3f8600' }} 
              prefix={<HeartOutlined />} 
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="Active Alerts" 
              value={activeAlerts.length} 
              prefix={<AlertOutlined />} 
              valueStyle={{ color: activeAlerts.length > 0 ? '#cf1322' : '#000' }} 
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Services Online" value="4 / 4" prefix={<ApiOutlined />} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
      </Row>

      <Card title="System Alerts & Incident Log" extra={<FieldTimeOutlined />}>
        <Table 
          columns={columns} 
          dataSource={alerts} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
};

export default SystemHealthDashboard;
