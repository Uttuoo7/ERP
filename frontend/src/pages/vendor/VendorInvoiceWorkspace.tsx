import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, Button, Tag, Upload } from 'antd';
import { FileText } from 'lucide-react';
import { UploadOutlined } from '@ant-design/icons';

export function VendorInvoiceWorkspace() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = () => {
    fetch('http://localhost:8000/api/portal/vendor/invoices', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(data => {
      setInvoices(data);
      setLoading(false);
    })
    .catch(console.error);
  };

  const columns = [
    { title: 'Invoice No.', dataIndex: 'invoice_number', render: (text: string) => <span className="font-semibold text-indigo-600">{text}</span> },
    { title: 'Date Submitted', dataIndex: 'created_at', render: (d: string) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) },
    { title: 'Amount', dataIndex: 'total_amount', render: (amt: number) => `$${Number(amt).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', render: (status: string) => (
      <Tag color={status === 'PAID' ? 'green' : status === 'APPROVED' ? 'blue' : 'orange'}>
        {status}
      </Tag>
    )},
    { title: 'Action', key: 'action', render: () => (
      <Button size="small" icon={<FileText size={14}/>}>View Details</Button>
    )}
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices & Payments</h1>
          <p className="text-slate-500">Track your submitted invoices and expected payments.</p>
        </div>
        <Upload>
          <Button type="primary" className="bg-indigo-600" icon={<UploadOutlined size={16}/>}>Upload New Invoice</Button>
        </Upload>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Table 
            dataSource={invoices}
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
