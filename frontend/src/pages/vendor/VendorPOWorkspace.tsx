import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, Button, Tag, notification } from 'antd';
import { CheckCircle, FileText, Download } from 'lucide-react';
import { getVendorPOs, acknowledgeVendorPO } from '../../api';

export function VendorPOWorkspace() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = () => {
    getVendorPOs()
    .then(res => {
      setPos(res.data);
      setLoading(false);
    })
    .catch(console.error);
  };

  const handleAcknowledge = async (poId: string) => {
    try {
      await acknowledgeVendorPO(poId);
      notification.success({ message: 'Purchase Order Acknowledged', description: 'The buyer has been notified.' });
      fetchPOs();
    } catch (e) {
      console.error(e);
      notification.error({ message: 'Error', description: 'Failed to acknowledge PO.' });
    }
  };

  const columns = [
    { title: 'PO Number', dataIndex: 'po_number', render: (text: string) => <span className="font-semibold text-indigo-600">{text || 'Pending Generation'}</span> },
    { title: 'Order Date', dataIndex: 'created_at', render: (d: string) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) },
    { title: 'Expected Delivery', dataIndex: 'expected_delivery_date', render: (d: string) => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Set' },
    { title: 'Amount', dataIndex: 'total_amount', render: (amt: number) => `$${Number(amt).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', render: (status: string) => (
      <Tag color={status === 'DRAFT' ? 'orange' : status === 'ISSUED' ? 'blue' : 'green'}>
        {status === 'DRAFT' ? 'NEEDS ACKNOWLEDGEMENT' : status}
      </Tag>
    )},
    { title: 'Action', key: 'action', render: (_: any, record: any) => (
      <div className="flex gap-2">
        <Button size="small" icon={<FileText size={14}/>}>View</Button>
        {record.status === 'DRAFT' && (
          <Button size="small" type="primary" className="bg-emerald-600 border-emerald-600" onClick={() => handleAcknowledge(record.id)} icon={<CheckCircle size={14}/>}>
            Acknowledge
          </Button>
        )}
      </div>
    )}
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500">Manage orders issued to you, acknowledge receipt, and track fulfillment.</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Table 
            dataSource={pos}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
