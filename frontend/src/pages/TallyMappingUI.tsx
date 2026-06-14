import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Input, Select, notification, Space, Typography, Popconfirm } from 'antd';
import { ApiOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { get, post, del } from "../api";
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface LedgerMapping {
  id: string;
  entity_type: string;
  internal_id: string;
  tally_ledger_name: string;
  is_synced: boolean;
  updated_at: string;
}

const TallyMappingUI: React.FC = () => {
  const [mappings, setMappings] = useState<LedgerMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  
  const [entityFilter, setEntityFilter] = useState<string>('');

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const url = entityFilter ? `/tally-mappings?entity_type=${entityFilter}` : `/tally-mappings`;
      const res = await get(url);
      setMappings(res.data);
    } catch (error) {
      notification.error({ message: 'Failed to fetch ledger mappings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, [entityFilter]);

  const handleAddMapping = async (values: any) => {
    try {
      await post('/tally-mappings', values);
      notification.success({ message: 'Mapping saved successfully' });
      form.resetFields();
      fetchMappings();
    } catch (error) {
      notification.error({ message: 'Failed to save mapping' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del(`/tally-mappings/${id}`);
      notification.success({ message: 'Mapping deleted' });
      fetchMappings();
    } catch (error) {
      notification.error({ message: 'Failed to delete mapping' });
    }
  };

  const columns = [
    { title: 'Entity Type', dataIndex: 'entity_type', key: 'entity_type', render: (text: string) => <strong>{text}</strong> },
    { title: 'Internal ID (ERP)', dataIndex: 'internal_id', key: 'internal_id' },
    { title: 'Tally Ledger Name', dataIndex: 'tally_ledger_name', key: 'tally_ledger_name', render: (text: string) => <Text type="success">{text}</Text> },
    { title: 'Last Updated', dataIndex: 'updated_at', key: 'updated_at', render: (val: string) => dayjs(val).format('DD MMM YYYY HH:mm') },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: LedgerMapping) => (
        <Popconfirm title="Delete this mapping?" onConfirm={() => handleDelete(record.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}><ApiOutlined /> Master Data Ledger Mapping</Title>
          <Text type="secondary">Map ERP entities to TallyPrime Ledger names for accurate voucher exports.</Text>
        </div>
      </div>

      <Card title="Add New Mapping" style={{ marginBottom: 24 }}>
        <Form form={form} layout="inline" onFinish={handleAddMapping}>
          <Form.Item name="entity_type" rules={[{ required: true, message: 'Required' }]}>
            <Select 
              placeholder="Entity Type" 
              style={{ width: 150 }}
              options={[
                { value: "VENDOR", label: "Vendor" },
                { value: "TAX", label: "Tax Ledger" },
                { value: "BANK", label: "Bank Account" },
                { value: "COST_CENTER", label: "Cost Center" }
              ]}
            />
          </Form.Item>
          <Form.Item name="internal_id" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Internal ERP ID or Code" />
          </Form.Item>
          <Form.Item name="tally_ledger_name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Exact Tally Ledger Name" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Save Mapping</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card 
        title="Current Mappings" 
        extra={
          <Select 
            value={entityFilter} 
            onChange={setEntityFilter} 
            style={{ width: 150 }} 
            allowClear 
            placeholder="Filter by Entity"
            options={[
              { value: "VENDOR", label: "Vendor" },
              { value: "TAX", label: "Tax Ledger" },
              { value: "BANK", label: "Bank Account" },
              { value: "COST_CENTER", label: "Cost Center" }
            ]}
          />
        }
      >
        <Table 
          columns={columns} 
          dataSource={mappings} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
};

export default TallyMappingUI;
