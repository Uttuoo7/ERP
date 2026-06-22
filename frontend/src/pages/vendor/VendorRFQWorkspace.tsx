import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table, Button, Tag, Modal, Form, Input, InputNumber, DatePicker } from 'antd';
import { Search, Eye, Send } from 'lucide-react';
import { getVendorRFQs, getVendorRFQDetails, submitVendorRFQQuotation } from '../../api';

export function VendorRFQWorkspace() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRfq, setSelectedRfq] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRfqs();
  }, []);

  const fetchRfqs = () => {
    getVendorRFQs()
    .then(res => {
      setRfqs(res.data);
      setLoading(false);
    })
    .catch(console.error);
  };

  const handleOpenRfq = (rfqInvitation: any) => {
    getVendorRFQDetails(rfqInvitation.rfq_id)
    .then(res => {
      const data = res.data;
      setSelectedRfq(data);
      form.setFieldsValue({
        line_items: data.line_items.map((line: any) => ({
          rfq_line_id: line.id,
          unit_price: 0,
          tax_rate: 0,
          lead_time_days: 7
        }))
      });
      setIsModalOpen(true);
    });
  };

  const handleSubmitQuote = async (values: any) => {
    try {
      const payload = {
        quotation_number: `QT-${new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14)}`,
        validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...values
      };
      
      await submitVendorRFQQuotation(selectedRfq.id, payload);
      
      setIsModalOpen(false);
      fetchRfqs();
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    { title: 'Invitation ID', dataIndex: 'id', render: (text: string) => <span className="text-xs font-mono text-gray-500">{text.split('-')[0]}</span> },
    { title: 'Date Invited', dataIndex: 'invited_date', render: (d: string) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) },
    { title: 'Status', dataIndex: 'invitation_status', render: (status: string) => (
      <Tag color={status === 'RESPONDED' ? 'green' : status === 'VIEWED' ? 'blue' : 'orange'}>{status}</Tag>
    )},
    { title: 'Action', key: 'action', render: (_: any, record: any) => (
      <Button size="small" type="primary" className="bg-indigo-600" onClick={() => handleOpenRfq(record)} disabled={record.invitation_status === 'RESPONDED'}>
        {record.invitation_status === 'RESPONDED' ? 'Quote Submitted' : 'View & Quote'}
      </Button>
    )}
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RFQ Inbox</h1>
          <p className="text-slate-500">View invitations to quote and submit your proposals.</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Table 
            dataSource={rfqs}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </CardContent>
      </Card>

      <Modal
        title={`Submit Quotation for ${selectedRfq?.rfq_number}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={800}
      >
        {selectedRfq && (
          <Form form={form} layout="vertical" onFinish={handleSubmitQuote}>
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs text-slate-500 font-medium">Due Date</p>
                <p className="font-semibold">{new Date(selectedRfq.due_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Currency</p>
                <p className="font-semibold">{selectedRfq.currency}</p>
              </div>
            </div>

            <h3 className="font-semibold mb-3">Line Items Pricing</h3>
            <Form.List name="line_items">
              {(fields) => (
                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const lineItem = selectedRfq.line_items[index];
                    return (
                      <div key={field.key} className="flex gap-4 items-end bg-white p-4 rounded border border-slate-200 shadow-sm">
                        <div className="flex-1">
                          <p className="text-sm font-semibold truncate" title={lineItem.item.name}>{lineItem.item.name}</p>
                          <p className="text-xs text-slate-500">Qty: {lineItem.quantity} {lineItem.uom}</p>
                        </div>
                        <Form.Item name={[field.name, 'rfq_line_id']} hidden><Input /></Form.Item>
                        <Form.Item name={[field.name, 'unit_price']} label="Unit Price" rules={[{required:true}]} className="mb-0">
                          <InputNumber min={0} className="w-32" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'tax_rate']} label="Tax (%)" rules={[{required:true}]} className="mb-0">
                          <InputNumber min={0} max={100} className="w-24" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'lead_time_days']} label="Lead (Days)" rules={[{required:true}]} className="mb-0">
                          <InputNumber min={1} className="w-24" />
                        </Form.Item>
                      </div>
                    );
                  })}
                </div>
              )}
            </Form.List>

            <div className="mt-8 flex justify-end gap-3">
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" className="bg-indigo-600 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Submit Official Quote
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}
