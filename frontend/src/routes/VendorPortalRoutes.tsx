import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { VendorLayout } from '../components/layout/VendorLayout';
import { Loader2 } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   VendorPortalRoutes — Isolated Vendor Route Registry
   ─────────────────────────────────────────────────────────────────────────
   Security: Only users with role 'VENDOR' or 'vendor' can access.
   All routes prefixed with /portal/*
   Completely separate from internal ERP routes.
   ═══════════════════════════════════════════════════════════════════════════ */

// Lazy-load vendor pages for code splitting
const VendorDashboard    = lazy(() => import('../pages/vendor/VendorDashboard'));
const VendorRFQCenter    = lazy(() => import('../pages/vendor/VendorRFQCenter'));
const VendorPOCenter     = lazy(() => import('../pages/vendor/VendorPOCenter'));
const VendorInvoiceCenter = lazy(() => import('../pages/vendor/VendorInvoiceCenter'));
const VendorPaymentTracker = lazy(() => import('../pages/vendor/VendorPaymentTracker'));
const VendorDocuments    = lazy(() => import('../pages/vendor/VendorDocuments'));

function PortalFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
    </div>
  );
}

/**
 * Security gate — redirects non-vendor users to the internal ERP.
 * Vendors attempting to access internal routes are redirected here.
 */
function VendorGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userRole = useAuthStore(state => state.user?.role);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isVendor = userRole?.toUpperCase() === 'VENDOR';
  if (!isVendor) return <Navigate to="/analytics" replace />;

  return <>{children}</>;
}

export default function VendorPortalRoutes() {
  return (
    <VendorGuard>
      <VendorLayout>
        <Suspense fallback={<PortalFallback />}>
          <Routes>
            <Route path="dashboard"  element={<VendorDashboard />} />
            <Route path="rfqs"       element={<VendorRFQCenter />} />
            <Route path="pos"        element={<VendorPOCenter />} />
            <Route path="invoices"   element={<VendorInvoiceCenter />} />
            <Route path="payments"   element={<VendorPaymentTracker />} />
            <Route path="documents"  element={<VendorDocuments />} />
            <Route path="*"          element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Suspense>
      </VendorLayout>
    </VendorGuard>
  );
}
