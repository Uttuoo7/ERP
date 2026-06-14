import React from 'react';

export type BadgeStatus = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
}

const statusStyles: Record<BadgeStatus, string> = {
  success: 'bg-status-success-bg text-status-success-text',
  error: 'bg-status-error-bg text-status-error-text',
  warning: 'bg-status-warning-bg text-status-warning-text',
  info: 'bg-status-info-bg text-status-info-text',
  neutral: 'bg-status-neutral-bg text-status-neutral-text',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-erp text-xs font-bold uppercase tracking-wider ${statusStyles[status]}`}>
      {label}
    </span>
  );
};
