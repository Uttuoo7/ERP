import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Badge, Tag, notification, Space, Typography, Spin, Divider } from 'antd';
import { ApiOutlined, ReloadOutlined, PlusOutlined, LinkOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { get, post } from "../api";
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface IntegrationConfig {
  id: string;
  provider_name: string;
  is_active: boolean;
  endpoint_url: string;
  auth_type: string;
  created_at: string;
}

interface SyncLog {
  id: string;
  integration_id: string;
  entity_type: string;
  entity_id: string;
  direction: string;
  status: string;
  retry_count: number;
  last_attempt_at: string;
  error_message: string;
}

const IntegrationHub: React.FC = () => {
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configsData, logsData] = await Promise.all([
        get('/integrations/configs'),
        get('/integrations/logs')
      ]);
      setConfigs(configsData);
      setLogs(logsData);
    } catch (error) {
      notification.error({ message: 'Failed to load integration data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddIntegration = async (values: any) => {
    try {
      await post('/integrations/configs', values);
      notification.success({ message: 'Integration added successfully' });
      setIsModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      notification.error({ message: 'Failed to add integration' });
    }
  };

  const handleRetry = async (logId: string) => {
    try {
      await post(`/integrations/logs/${logId}/retry`, {});
      notification.success({ message: 'Retry queued successfully' });
      fetchData();
    } catch (error) {
      notification.error({ message: 'Failed to retry sync' });
    }
  };

  const configColumns = [
    { title: 'Provider', dataIndex: 'provider_name', key: 'provider_name', render: (text: string) => <strong>{text}</strong> },
    { title: 'Endpoint', dataIndex: 'endpoint_url', key: 'endpoint_url' },
    { title: 'Auth Type', dataIndex: 'auth_type', key: 'auth_type' },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (active: boolean) => (
      <Badge status={active ? "success" : "default"} text={active ? "Active" : "Inactive"} />
    )},
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (val: string) => dayjs(val).format('DD MMM YYYY') },
  ];

  const logColumns = [
    { title: 'Time', dataIndex: 'last_attempt_at', key: 'last_attempt_at', render: (val: string) => dayjs(val).format('DD MMM HH:mm:ss') },
    { title: 'Entity', dataIndex: 'entity_type', key: 'entity_type', render: (text: string, record: SyncLog) => (
      <Space>
        <Tag color="blue">{text}</Tag>
        <Text type="secondary" ellipsis style={{ maxWidth: 100 }}>{record.entity_id}</Text>
      </Space>
    )},
    { title: 'Direction', dataIndex: 'direction', key: 'direction', render: (val: string) => (
      <Tag icon={val === 'OUTBOUND' ? <ApiOutlined /> : <SyncOutlined />}>{val}</Tag>
    )},
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val: string) => {
      let color = 'default';
      let icon = <SyncOutlined spin />;
      if (val === 'SUCCESS') { color = 'success'; icon = <CheckCircleOutlined />; }
      if (val === 'FAILED') { color = 'error'; icon = <CloseCircleOutlined />; }
      return <Tag color={color} icon={icon}>{val}</Tag>;
    }},
    { title: 'Retries', dataIndex: 'retry_count', key: 'retry_count' },
    { title: 'Error', dataIndex: 'error_message', key: 'error_message', render: (val: string) => <Text type="danger">{val}</Text> },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: SyncLog) => (
        record.status === 'FAILED' ? 
        <Button type="link" size="small" onClick={() => handleRetry(record.id)}>Retry</Button> : null
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}><ApiOutlined /> Enterprise Integration Hub</Title>
          <Text type="secondary">Manage external accounting syncs, webhooks, and event flows.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            Add Connection
          </Button>
        </Space>
      </div>

      <Card title="Active Connections" style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Table 
          columns={configColumns} 
          dataSource={configs} 
          rowKey="id" 
          pagination={false}
          loading={loading}
        />
      </Card>

      <Card title="Sync Activity Logs" style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Table 
          columns={logColumns} 
          dataSource={logs} 
          rowKey="id" 
          loading={loading}
          size="small"
        />
      </Card>

      <Modal
        title="Add New Integration Connection"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddIntegration}>
          <Form.Item name="provider_name" label="Provider / Target" rules={[{ required: true }]}>
            <Select placeholder="Select Provider">
              <Option value="TALLY">Tally Prime (XML ODBC/API)</Option>
              <Option value="SAP">SAP ECC/S4HANA (OData/BAPI)</Option>
              <Option value="ZOHO">Zoho Books</Option>
              <Option value="WEBHOOK">Generic Webhook</Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="endpoint_url" label="Endpoint URL">
            <Input placeholder="https://api.example.com/webhook or http://localhost:9000" />
          </Form.Item>

          <Form.Item name="auth_type" label="Authentication Type" initialValue="BEARER">
            <Select>
              <Option value="NONE">None</Option>
              <Option value="BASIC">Basic Auth</Option>
              <Option value="BEARER">Bearer Token</Option>
              <Option value="API_KEY">API Key</Option>
            </Select>
          </Form.Item>

          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save Connection</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default IntegrationHub;
