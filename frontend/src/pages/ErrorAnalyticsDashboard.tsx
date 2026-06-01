import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Tag, notification } from 'antd';
import { BugOutlined, DashboardOutlined } from '@ant-design/icons';
import { get } from "../api";
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ErrorAnalyticsDashboard: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApiMetrics = async () => {
      try {
        const data = await get('/observability/metrics/api');
        setLogs(data);
      } catch (error) {
        notification.error({ message: 'Failed to fetch API metrics' });
      } finally {
        setLoading(false);
      }
    };
    fetchApiMetrics();
  }, []);

  const columns = [
    { title: 'Time', dataIndex: 'created_at', key: 'created_at', render: (val: string) => dayjs(val).format('HH:mm:ss') },
    { title: 'Method', dataIndex: 'method', key: 'method', render: (val: string) => <Tag color={val === 'GET' ? 'blue' : 'green'}>{val}</Tag> },
    { title: 'Endpoint', dataIndex: 'endpoint', key: 'endpoint', render: (val: string) => <Text strong>{val}</Text> },
    { title: 'Status', dataIndex: 'status_code', key: 'status_code', render: (val: number) => {
      if (val >= 500) return <Tag color="error">{val}</Tag>;
      if (val >= 400) return <Tag color="warning">{val}</Tag>;
      return <Tag color="success">{val}</Tag>;
    }},
    { title: 'Latency (ms)', dataIndex: 'response_time_ms', key: 'response_time_ms', render: (val: number) => {
      const color = val > 1000 ? 'danger' : val > 500 ? 'warning' : 'success';
      return <Text type={color}>{val?.toFixed(2)} ms</Text>;
    }},
    { title: 'Error Details', dataIndex: 'error_details', key: 'error_details', render: (val: string) => val ? <Text type="danger" ellipsis={{ tooltip: val }} style={{ maxWidth: 200 }}>{val}</Text> : '-' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}><DashboardOutlined /> APM & Error Analytics</Title>
      <Text type="secondary">Review API latencies, HTTP 500 errors, and stack traces.</Text>

      <Card style={{ marginTop: 24 }} title={<><BugOutlined /> Recent API Requests</>}>
        <Table 
          columns={columns} 
          dataSource={logs} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 15 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default ErrorAnalyticsDashboard;
