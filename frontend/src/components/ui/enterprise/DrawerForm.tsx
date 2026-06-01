import React from 'react';
import { Drawer, Button, Space } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

interface DrawerFormProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  width?: number | string;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function DrawerForm({
  title,
  isOpen,
  onClose,
  onSubmit,
  children,
  width = 500,
  submitLabel = 'Save',
  isSubmitting = false
}: DrawerFormProps) {
  return (
    <Drawer
      title={<span className="font-extrabold text-slate-900 tracking-tight">{title}</span>}
      placement="right"
      width={width}
      onClose={onClose}
      open={isOpen}
      closeIcon={<CloseOutlined className="text-slate-400 hover:text-slate-900" />}
      styles={{
        header: { borderBottom: '1px solid #f1f5f9', padding: '16px 24px' },
        body: { padding: '24px', backgroundColor: '#f8fafc' },
        footer: { borderTop: '1px solid #f1f5f9', padding: '16px 24px', backgroundColor: '#fff' }
      }}
      footer={
        <div className="flex justify-end w-full">
          <Space>
            <Button onClick={onClose} disabled={isSubmitting} className="font-semibold text-slate-600 border-slate-200">
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={onSubmit} 
              loading={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 font-semibold"
            >
              {submitLabel}
            </Button>
          </Space>
        </div>
      }
    >
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        {children}
      </div>
    </Drawer>
  );
}
