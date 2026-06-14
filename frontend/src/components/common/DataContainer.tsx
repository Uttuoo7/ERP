import React from 'react';

interface DataContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const DataContainer: React.FC<DataContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-erp border border-erp-border shadow-erp-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
};
