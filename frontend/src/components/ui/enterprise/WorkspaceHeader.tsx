import React from 'react';
import { Breadcrumb, Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { title: string; href?: string }[];
  primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode; disabled?: boolean };
  secondaryActions?: React.ReactNode;
  onBack?: () => void;
}

export function WorkspaceHeader({
  title,
  subtitle,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  onBack
}: WorkspaceHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-40 shadow-sm">
      {breadcrumbs && (
        <div className="mb-2">
          <Breadcrumb items={breadcrumbs} className="text-xs font-medium text-slate-500" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} className="text-slate-400 hover:text-slate-900" />
          )}
          <div>
            <Title level={3} style={{ margin: 0 }} className="text-slate-900 font-extrabold tracking-tight">
              {title}
            </Title>
            {subtitle && <Text className="text-slate-500 text-sm">{subtitle}</Text>}
          </div>
        </div>
        <Space>
          {secondaryActions}
          {primaryAction && (
            <Button
              type="primary"
              icon={primaryAction.icon}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 font-semibold"
            >
              {primaryAction.label}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}
