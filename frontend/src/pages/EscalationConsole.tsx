import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Tag, notification, Tabs, Button, Space } from 'antd';
import { AlertOutlined, ClockCircleOutlined, FireOutlined } from '@ant-design/icons';
import { get } from "../api";
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const EscalationConsole: React.FC = () => {
  const [activeTimers, setActiveTimers] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [timersData, escalationsData] = await Promise.all([
        get('/sla/timers?status=ACTIVE'),
        get('/sla/escalations')
      ]);
      setActiveTimers(timersData);
      setEscalations(escalationsData);
    } catch (error) {
      notification.error({ message: 'Failed to fetch SLA data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const timerColumns = [
    { title: 'Workflow Entity', dataIndex: 'entity_type', key: 'entity_type', render: (val: string) => <Text strong>{val}</Text> },
    { title: 'Policy', dataIndex: 'policy_name', key: 'policy_name' },
    { title: 'Deadline', dataIndex: 'deadline', key: 'deadline', render: (val: string) => {
      const isOverdue = dayjs().isAfter(dayjs(val));
      return <Text type={isOverdue ? 'danger' : 'warning'}>{dayjs(val).format('DD MMM YYYY HH:mm')}</Text>;
    }},
    { title: 'Escalation Level', dataIndex: 'escalation_level', key: 'escalation_level', render: (val: string) => <Tag color="volcano">{val}</Tag> },
    { title: 'Action', key: 'action', render: () => <Button size="small">Nudge Assigner</Button> }
  ];

  const escalationColumns = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (val: string) => dayjs(val).format('DD MMM YYYY HH:mm') },
    { title: 'Entity Type', dataIndex: 'entity_type', key: 'entity_type', render: (val: string) => <Tag color="blue">{val}</Tag> },
    { title: 'Action Taken', dataIndex: 'escalation_action', key: 'escalation_action', render: (val: string) => <Text strong type="danger"><FireOutlined /> {val}</Text> },
    { title: 'Details', dataIndex: 'details', key: 'details' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}><AlertOutlined /> Escalation Console</Title>
      <Text type="secondary">Monitor workflow delays, active SLA timers, and past automatic escalations.</Text>

      <Card style={{ marginTop: 24 }}>
        <Tabs defaultActiveKey="1" tabBarExtraContent={<Button onClick={fetchData}>Refresh Data</Button>}>
          <TabPane tab={<span><ClockCircleOutlined /> Active Timers ({activeTimers.length})</span>} key="1">
            <Table 
              columns={timerColumns} 
              dataSource={activeTimers} 
              rowKey="timer_id" 
              loading={loading}
              pagination={{ pageSize: 15 }}
            />
          </TabPane>
          <TabPane tab={<span><FireOutlined /> Escalation Logs</span>} key="2">
            <Table 
              columns={escalationColumns} 
              dataSource={escalations} 
              rowKey="log_id" 
              loading={loading}
              pagination={{ pageSize: 15 }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default EscalationConsole;
