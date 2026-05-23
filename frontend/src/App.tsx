import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardSkeleton from './components/DashboardSkeleton';
import NotificationDropdown from './components/NotificationDropdown';
import { AuthProvider, useAuth } from './AuthContext';

// --- Dynamic Route Lazy Loading Optimizations ---
const VendorList = lazy(() => import('./pages/VendorList'));
const ItemCatalog = lazy(() => import('./pages/ItemCatalog'));
const POList = lazy(() => import('./pages/POList'));
const PurchaseOrderForm = lazy(() => import('./pages/PurchaseOrderForm'));
const ReceiveGoods = lazy(() => import('./pages/ReceiveGoods'));
const InvoiceDashboard = lazy(() => import('./pages/InvoiceDashboard'));
const InvoiceEntryWorkspace = lazy(() => import('./pages/InvoiceEntryWorkspace'));
const InvoiceDetailWorkspace = lazy(() => import('./pages/InvoiceDetailWorkspace'));
const Login = lazy(() => import('./pages/Login'));
const SOList = lazy(() => import('./pages/SOList'));
const SOForm = lazy(() => import('./pages/SOForm'));
const SODetails = lazy(() => import('./pages/SODetails'));
const PurchaseOrderEdit = lazy(() => import('./pages/PurchaseOrderEdit'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const MasterManager = lazy(() => import('./pages/MasterManager'));
const WorkflowInbox = lazy(() => import('./pages/WorkflowInbox'));
const WorkflowBuilder = lazy(() => import('./pages/WorkflowBuilder'));
const PRList = lazy(() => import('./pages/PRList'));
const PRForm = lazy(() => import('./pages/PRForm'));
const PRDetails = lazy(() => import('./pages/PRDetails'));
const RFQList = lazy(() => import('./pages/RFQList'));
const RFQForm = lazy(() => import('./pages/RFQForm'));
const RFQCompare = lazy(() => import('./pages/RFQCompare'));
const RFQDetails = lazy(() => import('./pages/RFQDetails'));
const POConverter = lazy(() => import('./pages/POConverter'));
const PODetails = lazy(() => import('./pages/PODetails'));
const WarehouseDashboard = lazy(() => import('./pages/WarehouseDashboard'));
const StockLedgerList = lazy(() => import('./pages/StockLedgerList'));
const StockAdjustment = lazy(() => import('./pages/StockAdjustment'));
const GRNList = lazy(() => import('./pages/GRNList'));
const POToGRNConverter = lazy(() => import('./pages/POToGRNConverter'));
const GRNDetails = lazy(() => import('./pages/GRNDetails'));
const QCConsole = lazy(() => import('./pages/QCConsole'));
const APLiabilityDashboard = lazy(() => import('./pages/APLiabilityDashboard'));
const LedgerExplorer = lazy(() => import('./pages/LedgerExplorer'));
const TallySyncQueue = lazy(() => import('./pages/TallySyncQueue'));
const RBACMatrixManager = lazy(() => import('./pages/RBACMatrixManager'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  return children;
}

function SidebarLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
  return (
    <Link
      to={to}
      className="erp-sidebar-link"
      style={{
        background: isActive ? 'var(--color-primary-50)' : undefined,
        color: isActive ? 'var(--color-primary-600)' : undefined,
        fontWeight: isActive ? 600 : undefined,
      }}
    >
      {children}
    </Link>
  );
}

function Sidebar() {
  const { role, logout, email } = useAuth();
  
  const isSuper = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN' || isSuper;
  const isProcurement = role === 'PROCUREMENT_MANAGER' || role === 'BUYER' || isAdmin;
  const isFinance = role === 'FINANCE_MANAGER' || role === 'FINANCE' || isAdmin;
  const isWarehouse = role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE' || isAdmin;
  const isEmployee = role === 'EMPLOYEE' || role === 'ADMIN';
  const isAuditor = role === 'AUDITOR' || isAdmin;

  return (
    <aside className="erp-sidebar">
      <div className="erp-sidebar-brand">
        <h2>P2P ERP</h2>
        <p style={{
          fontSize: '0.625rem',
          color: 'var(--text-tertiary)',
          fontWeight: 600,
          marginTop: '0.5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{email}</span>
        </p>
        <span className="erp-badge erp-badge-primary" style={{ marginTop: '0.5rem' }}>
          {role}
        </span>
      </div>
      <nav className="erp-sidebar-nav">
        <div>
          <div className="erp-sidebar-section-label">Workplace</div>
          <SidebarLink to="/inbox">Approval Tasks Inbox</SidebarLink>
          <SidebarLink to="/notifications">My Alerts Feed</SidebarLink>
        </div>

        {isProcurement && (
          <div>
            <div className="erp-sidebar-section-label">Insights</div>
            <SidebarLink to="/analytics">Operational Spend Metrics</SidebarLink>
          </div>
        )}

        {isAdmin && (
          <div>
            <div className="erp-sidebar-section-label">Administration</div>
            <SidebarLink to="/masters">Master Data Engine</SidebarLink>
            <SidebarLink to="/workflows/builder">Workflows Setup</SidebarLink>
            <SidebarLink to="/rbac/matrix">RBAC Roles Matrix</SidebarLink>
          </div>
        )}

        {(isProcurement || isEmployee) && (
          <div>
            <div className="erp-sidebar-section-label">Purchasing &amp; RFQ</div>
            <SidebarLink to="/requisitions">Purchase Requisitions</SidebarLink>
            {isProcurement && (
              <>
                <SidebarLink to="/rfqs">Requests For Quotations</SidebarLink>
                <SidebarLink to="/vendors">Vendors Registry</SidebarLink>
                <SidebarLink to="/pos">Purchase Orders</SidebarLink>
              </>
            )}
          </div>
        )}
        
        {isWarehouse && (
          <div>
            <div className="erp-sidebar-section-label">Warehouse &amp; Receipts</div>
            <SidebarLink to="/inventory">Stock Ledgers</SidebarLink>
            <SidebarLink to="/grns">Warehouse Receipts (GRN)</SidebarLink>
          </div>
        )}

        {isFinance && (
          <div>
            <div className="erp-sidebar-section-label">Accounts Payable</div>
            <SidebarLink to="/invoices">Vendor Invoices</SidebarLink>
            <SidebarLink to="/finance/liabilities">Accrued Liabilities</SidebarLink>
            <SidebarLink to="/finance/ledger">G/L Postings Explorer</SidebarLink>
            <SidebarLink to="/finance/tally">Tally ERP Exporters</SidebarLink>
          </div>
        )}
      </nav>
      <div style={{
        padding: '1.25rem 1rem',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={logout}
          className="erp-btn erp-btn-danger erp-btn-sm"
          style={{ width: '100%', fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}
        >
          Logout Session
        </button>
      </div>
    </aside>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-0)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header
          className="h-16 px-8 flex items-center justify-between shrink-0"
          style={{
            background: 'var(--surface-card)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
          }}>
            Enterprise ERP SaaS Platform
          </span>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
          </div>
        </header>
        <main className="flex-1" style={{ background: 'var(--surface-0)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Suspense fallback={<DashboardSkeleton />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/analytics" element={<ProtectedRoute><MainLayout><AnalyticsDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/masters" element={<ProtectedRoute><MainLayout><MasterManager /></MainLayout></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><MainLayout><WorkflowInbox /></MainLayout></ProtectedRoute>} />
              <Route path="/workflows/builder" element={<ProtectedRoute><MainLayout><WorkflowBuilder /></MainLayout></ProtectedRoute>} />
              
              {/* Dynamic RBAC matrix paths */}
              <Route path="/rbac/matrix" element={<ProtectedRoute><MainLayout><RBACMatrixManager /></MainLayout></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><MainLayout><NotificationCenter /></MainLayout></ProtectedRoute>} />

              <Route path="/requisitions" element={<ProtectedRoute><MainLayout><PRList /></MainLayout></ProtectedRoute>} />
              <Route path="/requisitions/new" element={<ProtectedRoute><MainLayout><PRForm /></MainLayout></ProtectedRoute>} />
              <Route path="/requisitions/:id/edit" element={<ProtectedRoute><MainLayout><PRForm /></MainLayout></ProtectedRoute>} />
              <Route path="/requisitions/:id" element={<ProtectedRoute><MainLayout><PRDetails /></MainLayout></ProtectedRoute>} />
              
              <Route path="/rfqs" element={<ProtectedRoute><MainLayout><RFQList /></MainLayout></ProtectedRoute>} />
              <Route path="/rfqs/new" element={<ProtectedRoute><MainLayout><RFQForm /></MainLayout></ProtectedRoute>} />
              <Route path="/rfqs/:id/compare" element={<ProtectedRoute><MainLayout><RFQCompare /></MainLayout></ProtectedRoute>} />
              <Route path="/rfqs/:id" element={<ProtectedRoute><MainLayout><RFQDetails /></MainLayout></ProtectedRoute>} />
              
              <Route path="/sales-orders" element={<ProtectedRoute><MainLayout><SOList /></MainLayout></ProtectedRoute>} />
              <Route path="/sales-orders/new" element={<ProtectedRoute><MainLayout><SOForm /></MainLayout></ProtectedRoute>} />
              <Route path="/sales-orders/:id" element={<ProtectedRoute><MainLayout><SODetails /></MainLayout></ProtectedRoute>} />
              
              <Route path="/vendors" element={<ProtectedRoute><MainLayout><VendorList /></MainLayout></ProtectedRoute>} />
              <Route path="/items" element={<ProtectedRoute><MainLayout><ItemCatalog /></MainLayout></ProtectedRoute>} />
              
              <Route path="/pos" element={<ProtectedRoute><MainLayout><POList /></MainLayout></ProtectedRoute>} />
              <Route path="/pos/convert" element={<ProtectedRoute><MainLayout><POConverter /></MainLayout></ProtectedRoute>} />
              <Route path="/pos/:id" element={<ProtectedRoute><MainLayout><PODetails /></MainLayout></ProtectedRoute>} />
              <Route path="/pos/:id/edit" element={<ProtectedRoute><MainLayout><PurchaseOrderEdit /></MainLayout></ProtectedRoute>} />
              
              <Route path="/grns" element={<ProtectedRoute><MainLayout><GRNList /></MainLayout></ProtectedRoute>} />
              <Route path="/grns/convert" element={<ProtectedRoute><MainLayout><POToGRNConverter /></MainLayout></ProtectedRoute>} />
              <Route path="/grns/:id" element={<ProtectedRoute><MainLayout><GRNDetails /></MainLayout></ProtectedRoute>} />
              <Route path="/grns/:id/qc" element={<ProtectedRoute><MainLayout><QCConsole /></MainLayout></ProtectedRoute>} />
              
              <Route path="/invoices" element={<ProtectedRoute><MainLayout><InvoiceDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute><MainLayout><InvoiceEntryWorkspace /></MainLayout></ProtectedRoute>} />
              <Route path="/invoices/:id" element={<ProtectedRoute><MainLayout><InvoiceDetailWorkspace /></MainLayout></ProtectedRoute>} />
              
              <Route path="/finance/liabilities" element={<ProtectedRoute><MainLayout><APLiabilityDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/ledger" element={<ProtectedRoute><MainLayout><LedgerExplorer /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/tally" element={<ProtectedRoute><MainLayout><TallySyncQueue /></MainLayout></ProtectedRoute>} />
              
              <Route path="/inventory" element={<ProtectedRoute><MainLayout><WarehouseDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/ledger" element={<ProtectedRoute><MainLayout><StockLedgerList /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/adjust" element={<ProtectedRoute><MainLayout><StockAdjustment /></MainLayout></ProtectedRoute>} />
              
              <Route path="/" element={<ProtectedRoute><MainLayout><Navigate to="/analytics" replace /></MainLayout></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </Router>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
