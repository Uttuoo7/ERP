import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
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
    <aside className="w-64 bg-white shadow-md flex flex-col min-h-screen shrink-0 border-r border-slate-150 text-xs font-semibold text-slate-500">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-black text-blue-600 tracking-widest uppercase">P2P ERP Gateway</h2>
        <p className="text-[10px] text-slate-400 font-bold mt-1.5 truncate">User: <span className="font-extrabold text-slate-700">{email}</span></p>
        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-black text-[9px] mt-2 inline-block uppercase tracking-wider">{role}</span>
      </div>
      <nav className="mt-4 flex-1 overflow-y-auto px-4 py-2 space-y-5">
        <div className="space-y-1">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">Workplace</h3>
          <Link to="/inbox" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Approval Tasks Inbox</Link>
          <Link to="/notifications" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">My Alerts Feed</Link>
        </div>

        {isProcurement && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">Insights</h3>
            <Link to="/analytics" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Operational Spend Metrics</Link>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">Administration</h3>
            <Link to="/masters" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Master Data Engine</Link>
            <Link to="/workflows/builder" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Workflows Setup</Link>
            <Link to="/rbac/matrix" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">RBAC Roles Matrix</Link>
          </div>
        )}

        {(isProcurement || isEmployee) && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">Purchasing & RFQ</h3>
            <Link to="/requisitions" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Purchase Requisitions</Link>
            {isProcurement && (
              <>
                <Link to="/rfqs" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Requests For Quotations</Link>
                <Link to="/vendors" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Vendors Registry</Link>
                <Link to="/pos" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Purchase Orders</Link>
              </>
            )}
          </div>
        )}
        
        {isWarehouse && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">Warehouse & Receipts</h3>
            <Link to="/inventory" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Stock Ledgers</Link>
            <Link to="/grns" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Warehouse Receipts (GRN)</Link>
          </div>
        )}

        {isFinance && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">Accounts Payable</h3>
            <Link to="/invoices" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Vendor Invoices</Link>
            <Link to="/finance/liabilities" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Accrued Liabilities</Link>
            <Link to="/finance/ledger" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">G/L Postings Explorer</Link>
            <Link to="/finance/tally" className="block px-3 py-2 text-slate-650 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">Tally ERP Exporters</Link>
          </div>
        )}
      </nav>
      <div className="p-6 border-t border-slate-100">
        <button onClick={logout} className="w-full px-4 py-2.5 bg-rose-50 hover:bg-rose-100/55 border border-rose-100 text-rose-600 rounded-xl transition-all font-black text-center uppercase tracking-wider">Logout Session</button>
      </div>
    </aside>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-150 h-16 px-8 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-450 font-black uppercase tracking-widest">Enterprise ERP Maturity Sprint Gateway</span>
          <div className="flex items-center gap-4">
            <NotificationDropdown />
          </div>
        </header>
        <main className="flex-1">
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
