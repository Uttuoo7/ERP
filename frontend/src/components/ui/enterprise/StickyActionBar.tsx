import React from 'react';
import { Space } from 'antd';

interface StickyActionBarProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export function StickyActionBar({ children, align = 'right' }: StickyActionBarProps) {
  return (
    <div className={`fixed bottom-0 left-0 md:left-64 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 flex justify-${align === 'right' ? 'end' : align === 'left' ? 'start' : 'center'} items-center`}>
      <Space>
        {children}
      </Space>
    </div>
  );
}
