import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Input, Select, notification, InputNumber, Typography, Popconfirm, Tag } from 'antd';
import { RobotOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { get, post, del } from "../api";
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface SLAPolicy {
  id: string;
  name: string;
  entity_type: string;
  max_hours: number;
  escalation_level: string;
  is_active: boolean;
  created_at: string;
}

const SLAAutomationBuilder: React.FC = () => {
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await get('/sla/policies');
      setPolicies(res.data);
    } catch (error) {
      notification.error({ message: 'Failed to fetch SLA Policies' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await post('/sla/policies', values);
      notification.success({ message: 'Policy Created Successfully' });
      form.resetFields();
      fetchPolicies();
    } catch (error) {
      notification.error({ message: 'Failed to create policy' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del(`/sla/policies/${id}`);
      notification.success({ message: 'Policy Deleted' });
      fetchPolicies();
    } catch (error) {
      notification.error({ message: 'Failed to delete policy' });
    }
  };

  const columns = [
    { title: 'Rule Name', dataIndex: 'name', key: 'name', render: (text: string) => <Text strong>{text}</Text> },
    { title: 'Trigger Entity', dataIndex: 'entity_type', key: 'entity_type', render: (val: string) => <Tag color="blue">{val}</Tag> },
    { title: 'Max SLA (Hours)', dataIndex: 'max_hours', key: 'max_hours' },
    { title: 'Escalation Level', dataIndex: 'escalation_level', key: 'escalation_level', render: (val: string) => <Tag color="volcano">{val}</Tag> },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (val: boolean) => val ? <Tag color="success">Active</Tag> : <Tag color="default">Inactive</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: SLAPolicy) => (
        <Popconfirm title="Delete this policy?" onConfirm={() => handleDelete(record.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}><RobotOutlined /> SLA Automation Builder</Title>
          <Text type="secondary">Define operational SLA timers and auto-escalation rules.</Text>
        </div>
      </div>

      <Card title="Create New SLA Rule" style={{ marginBottom: 24 }}>
        <Form form={form} layout="inline" onFinish={handleCreate}>
          <Form.Item name="name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Rule Name (e.g. 48hr PR Approval)" />
          </Form.Item>
          <Form.Item name="entity_type" rules={[{ required: true, message: 'Required' }]}>
            <Select 
              placeholder="Select Workflow Trigger" 
              style={{ width: 220 }}
              options={[
                { value: "PURCHASE_REQUISITION", label: "PR Approval" },
                { value: "PURCHASE_ORDER", label: "PO Issuance" },
                { value: "GRN_PENDING", label: "GRN Pending" },
                { value: "INVOICE_MATCHING", label: "Invoice Matching" }
              ]}
            />
          </Form.Item>
          <Form.Item name="max_hours" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber placeholder="Max Hours" min={1} style={{ width: 120 }} addonAfter="hrs" />
          </Form.Item>
          <Form.Item name="escalation_level" rules={[{ required: true, message: 'Required' }]}>
            <Select 
              placeholder="Escalate To" 
              style={{ width: 150 }}
              options={[
                { value: "MANAGER", label: "Manager" },
                { value: "DIRECTOR", label: "Director" },
                { value: "PROCUREMENT_HEAD", label: "Procurement Head" },
                { value: "SYSTEM_AUTO_REJECT", label: "Auto Reject" }
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Create Rule</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Active Policies">
        <Table 
          columns={columns} 
          dataSource={policies} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
};

export default SLAAutomationBuilder;
