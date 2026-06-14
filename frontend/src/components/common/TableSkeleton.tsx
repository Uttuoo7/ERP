import React from 'react';

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="w-full">
      <div className="border-b border-erp-border bg-slate-50/50 px-6 py-4 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 rounded animate-pulse flex-1" />
        ))}
      </div>
      <div className="divide-y divide-erp-border">
        {Array.from({ length: rows }).map((_, rIndex) => (
          <div key={rIndex} className="px-6 py-4 flex gap-4">
            {Array.from({ length: columns }).map((_, cIndex) => (
              <div key={cIndex} className="h-4 bg-slate-100 rounded animate-pulse flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
