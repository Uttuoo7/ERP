import React from 'react';
import { Modal, Button, Space } from 'antd';

interface ModalFormProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  width?: number | string;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function ModalForm({
  title,
  isOpen,
  onClose,
  onSubmit,
  children,
  width = 600,
  submitLabel = 'Save',
  isSubmitting = false
}: ModalFormProps) {
  return (
    <Modal
      title={<span className="font-extrabold text-slate-900 text-lg tracking-tight">{title}</span>}
      open={isOpen}
      onCancel={onClose}
      width={width}
      centered
      styles={{
        header: { paddingBottom: 16, borderBottom: '1px solid #f1f5f9' },
        body: { paddingTop: 24, paddingBottom: 24 }
      }}
      footer={
        <div className="flex justify-end w-full pt-4 border-t border-slate-100">
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
      {children}
    </Modal>
  );
}
