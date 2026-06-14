import React from 'react';

interface ActionBarProps {
  children: React.ReactNode;
}

export const ActionBar: React.FC<ActionBarProps> = ({ children }) => {
  return (
    <div className="sticky bottom-0 mt-8 bg-white border-t border-erp-border py-4 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8 flex items-center justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
      {children}
    </div>
  );
};
