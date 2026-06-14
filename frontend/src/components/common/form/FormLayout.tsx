import React, { ReactNode } from 'react';

export const FormLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 relative pb-10">
      {children}
    </div>
  );
};

export const FormBody: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="max-w-[1600px] w-full mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
      {children}
    </div>
  );
};

export const FormSplitPane: React.FC<{ left: ReactNode; right: ReactNode }> = ({ left, right }) => {
  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      <div className="flex-1 w-full min-w-0 space-y-6">
        {left}
      </div>
      <div className="w-full xl:w-[350px] shrink-0 space-y-6 sticky top-36">
        {right}
      </div>
    </div>
  );
};
