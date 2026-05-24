import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeOutlined, InboxOutlined, AppstoreOutlined, BellOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

export function MobileBottomNav() {
  const navItems = [
    { to: '/', icon: <HomeOutlined className="text-xl" />, label: 'Home' },
    { to: '/inbox', icon: <InboxOutlined className="text-xl" />, label: 'Inbox' },
    { to: '/inventory', icon: <AppstoreOutlined className="text-xl" />, label: 'Warehouse' },
    { to: '/notifications', icon: <BellOutlined className="text-xl" />, label: 'Alerts' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`
          }
        >
          {item.icon}
          <Text className="text-[10px] leading-none" style={{ color: 'inherit' }}>{item.label}</Text>
        </NavLink>
      ))}
    </div>
  );
}
