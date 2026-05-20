import React from 'react';

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse text-xs">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200">
        <div className="space-y-2.5">
          <div className="h-6 w-52 bg-slate-200 rounded-lg"></div>
          <div className="h-3.5 w-80 bg-slate-200 rounded-md"></div>
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl"></div>
      </div>

      {/* Grid Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
            <div className="space-y-2 flex-1">
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
              <div className="h-5 w-28 bg-slate-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Primary worksheet panel skeleton */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="h-4 w-40 bg-slate-200 rounded"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 justify-between border-b border-slate-50 pb-3">
              <div className="space-y-2">
                <div className="h-4 w-48 bg-slate-200 rounded"></div>
                <div className="h-3 w-28 bg-slate-200 rounded"></div>
              </div>
              <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
