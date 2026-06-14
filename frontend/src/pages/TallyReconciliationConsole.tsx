import React, { useState, useEffect } from 'react';
import { Card, Table, Button, notification, Row, Col, Statistic, Typography, Tag } from 'antd';
import { SyncOutlined, CheckCircleOutlined, WarningOutlined, BugOutlined } from '@ant-design/icons';
import { get, post } from "../api";
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ReconciliationReport {
  id: string;
  reconciliation_date: string;
  total_erp_vouchers: number;
  total_tally_vouchers: number;
  erp_total_debit: number;
  tally_total_debit: number;
  mismatch_count: number;
  status: string;
  mismatch_details: string;
}

const TallyReconciliationConsole: React.FC = () => {
  const [reports, setReports] = useState<ReconciliationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await get('/tally-reconciliation');
      setReports(res.data);
    } catch (error) {
      notification.error({ message: 'Failed to fetch reconciliation reports' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleTriggerReconciliation = async () => {
    setTriggering(true);
    try {
      await post('/tally-reconciliation/trigger', {});
      notification.success({ message: 'Reconciliation completed successfully' });
      fetchReports();
    } catch (error) {
      notification.error({ message: 'Failed to trigger reconciliation' });
    } finally {
      setTriggering(false);
    }
  };

  const columns = [
    { title: 'Date', dataIndex: 'reconciliation_date', key: 'date', render: (val: string) => dayjs(val).format('DD MMM YYYY HH:mm') },
    { title: 'ERP Vouchers', dataIndex: 'total_erp_vouchers', key: 'erp_vouchers' },
    { title: 'Tally Vouchers', dataIndex: 'total_tally_vouchers', key: 'tally_vouchers' },
    { title: 'ERP Debit (₹)', dataIndex: 'erp_total_debit', key: 'erp_debit', render: (val: number) => val?.toFixed(2) },
    { title: 'Tally Debit (₹)', dataIndex: 'tally_total_debit', key: 'tally_debit', render: (val: number) => val?.toFixed(2) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => (
      status === 'MATCHED' ? <Tag color="success" icon={<CheckCircleOutlined />}>MATCHED</Tag> 
      : <Tag color="error" icon={<WarningOutlined />}>MISMATCH</Tag>
    )},
    { title: 'Details', dataIndex: 'mismatch_details', key: 'details', render: (text: string) => <Text type="danger" style={{ fontSize: '12px' }}>{text || '-'}</Text> },
  ];

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}><BugOutlined /> Daily Reconciliation Console</Title>
          <Text type="secondary">Ensure ERP and Tally ledgers are perfectly balanced.</Text>
        </div>
        <Button 
          type="primary" 
          icon={<SyncOutlined spin={triggering} />} 
          onClick={handleTriggerReconciliation}
          loading={triggering}
        >
          Run Reconciliation Now
        </Button>
      </div>

      {latestReport && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="ERP Vouchers (Latest)" value={latestReport.total_erp_vouchers} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Tally Vouchers (Latest)" value={latestReport.total_tally_vouchers} 
                valueStyle={{ color: latestReport.total_tally_vouchers !== latestReport.total_erp_vouchers ? '#cf1322' : '#3f8600' }} 
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="ERP Debit Total" value={latestReport.erp_total_debit} precision={2} prefix="₹" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Tally Debit Total" value={latestReport.tally_total_debit} precision={2} prefix="₹" 
                valueStyle={{ color: latestReport.tally_total_debit !== latestReport.erp_total_debit ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="Reconciliation History">
        <Table 
          columns={columns} 
          dataSource={reports} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default TallyReconciliationConsole;
