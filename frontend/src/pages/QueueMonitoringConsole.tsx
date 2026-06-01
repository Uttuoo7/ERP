import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Tag, notification } from 'antd';
import { DatabaseOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { get } from "../api";
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const QueueMonitoringConsole: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const data = await get('/observability/metrics/queue');
        setLogs(data);
      } catch (error) {
        notification.error({ message: 'Failed to fetch queue metrics' });
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, []);

  const columns = [
    { title: 'Time', dataIndex: 'created_at', key: 'created_at', render: (val: string) => dayjs(val).format('HH:mm:ss') },
    { title: 'Task Name', dataIndex: 'task_name', key: 'task_name', render: (val: string) => <Text strong>{val}</Text> },
    { title: 'Task ID', dataIndex: 'task_id', key: 'task_id', render: (val: string) => <Text code>{val.substring(0, 8)}...</Text> },
    { title: 'Duration (ms)', dataIndex: 'execution_time_ms', key: 'execution_time_ms', render: (val: number) => val?.toFixed(2) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val: string) => {
      if (val === 'SUCCESS') return <Tag color="success" icon={<CheckCircleOutlined />}>{val}</Tag>;
      return <Tag color="error" icon={<CloseCircleOutlined />}>{val}</Tag>;
    }},
    { title: 'Error Details', dataIndex: 'error_traceback', key: 'error_traceback', render: (val: string) => val ? <Text type="danger" ellipsis={{ tooltip: val }} style={{ maxWidth: 200 }}>{val}</Text> : '-' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}><DatabaseOutlined /> Celery Queue Console</Title>
      <Text type="secondary">Monitor background worker tasks and queue backlogs in real-time.</Text>

      <Card style={{ marginTop: 24 }}>
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

export default QueueMonitoringConsole;
