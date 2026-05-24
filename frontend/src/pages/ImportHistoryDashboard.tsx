import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Tag, notification } from 'antd';
import { HistoryOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { get } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ImportHistoryDashboard: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await get('/import/history');
        setBatches(data);
      } catch (error) {
        notification.error({ message: 'Failed to fetch import history' });
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const columns = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (val: string) => dayjs(val).format('DD MMM YYYY HH:mm') },
    { title: 'Entity', dataIndex: 'entity_type', key: 'entity_type', render: (val: string) => <Tag color="blue">{val}</Tag> },
    { title: 'File Name', dataIndex: 'filename', key: 'filename' },
    { title: 'Total Rows', dataIndex: 'total_rows', key: 'total_rows' },
    { title: 'Success', dataIndex: 'success_rows', key: 'success_rows', render: (val: number) => <Text type="success">{val}</Text> },
    { title: 'Failed', dataIndex: 'failed_rows', key: 'failed_rows', render: (val: number) => <Text type="danger">{val}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val: string) => {
      if (val === 'COMPLETED') return <Tag color="success" icon={<CheckCircleOutlined />}>{val}</Tag>;
      if (val === 'ROLLED_BACK' || val === 'FAILED') return <Tag color="error" icon={<CloseCircleOutlined />}>{val}</Tag>;
      return <Tag color="warning" icon={<WarningOutlined />}>{val}</Tag>;
    }},
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}><HistoryOutlined /> Import History & Audit</Title>
      <Text type="secondary">Review past data migrations and download error logs.</Text>
      
      <Card style={{ marginTop: 24 }}>
        <Table 
          columns={columns} 
          dataSource={batches} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
};

export default ImportHistoryDashboard;
