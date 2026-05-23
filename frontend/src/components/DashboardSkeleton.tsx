import React from 'react';

/**
 * Premium loading skeleton for the ERP dashboard.
 * Uses CSS shimmer animation from the design system (index.css).
 */
const DashboardSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-0)' }}>
      {/* Sidebar Skeleton */}
      <aside
        className="w-[260px] shrink-0 flex flex-col"
        style={{
          background: 'var(--surface-card)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <div className="p-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="erp-skeleton" style={{ height: '1.25rem', width: '70%', marginBottom: '0.75rem' }} />
          <div className="erp-skeleton" style={{ height: '0.625rem', width: '55%' }} />
        </div>
        <div className="p-4 space-y-6 flex-1">
          {[...Array(4)].map((_, g) => (
            <div key={g} className="space-y-2">
              <div className="erp-skeleton" style={{ height: '0.5rem', width: '40%', marginBottom: '0.75rem' }} />
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="erp-skeleton"
                  style={{ height: '2rem', width: '100%', borderRadius: 'var(--radius-md)' }}
                />
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar skeleton */}
        <header
          className="h-16 px-8 flex items-center justify-between shrink-0"
          style={{
            background: 'var(--surface-card)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div className="erp-skeleton" style={{ height: '0.75rem', width: '14rem' }} />
          <div className="flex items-center gap-3">
            <div className="erp-skeleton" style={{ height: '2rem', width: '2rem', borderRadius: 'var(--radius-full)' }} />
            <div className="erp-skeleton" style={{ height: '2rem', width: '2rem', borderRadius: 'var(--radius-full)' }} />
          </div>
        </header>

        {/* Page content skeleton */}
        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
          {/* Page title */}
          <div className="flex items-center justify-between pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="space-y-2">
              <div className="erp-skeleton erp-skeleton-heading" style={{ width: '16rem' }} />
              <div className="erp-skeleton erp-skeleton-text" style={{ width: '22rem' }} />
            </div>
            <div className="erp-skeleton" style={{ height: '2.5rem', width: '9rem', borderRadius: 'var(--radius-lg)' }} />
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="erp-skeleton erp-skeleton-card"
                style={{
                  animationDelay: `${i * 100}ms`,
                  height: '5.5rem',
                }}
              />
            ))}
          </div>

          {/* Data table skeleton */}
          <div
            className="erp-card"
            style={{ padding: '1.5rem' }}
          >
            <div className="erp-skeleton" style={{ height: '1rem', width: '10rem', marginBottom: '1.25rem' }} />
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 justify-between pb-3"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    animationDelay: `${i * 75}ms`,
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="erp-skeleton" style={{ height: '2rem', width: '2rem', borderRadius: 'var(--radius-sm)' }} />
                    <div className="space-y-1.5 flex-1">
                      <div className="erp-skeleton erp-skeleton-text" style={{ width: '60%' }} />
                      <div className="erp-skeleton erp-skeleton-text" style={{ width: '35%', height: '0.625rem' }} />
                    </div>
                  </div>
                  <div className="erp-skeleton" style={{ height: '1.75rem', width: '5rem', borderRadius: 'var(--radius-full)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
