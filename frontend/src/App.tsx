import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardSkeleton from './components/DashboardSkeleton';
import NotificationDropdown from './components/NotificationDropdown';
import { useAuthStore } from "./store/authStore";

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
const SmartInvoiceIngestion = lazy(() => import('./pages/SmartInvoiceIngestion'));
const VendorIntelligence = lazy(() => import('./pages/VendorIntelligence'));
const IntegrationHub = lazy(() => import('./pages/IntegrationHub'));
const TallyMappingUI = lazy(() => import('./pages/TallyMappingUI'));
const TallyReconciliationConsole = lazy(() => import('./pages/TallyReconciliationConsole'));
const DataMigrationWizard = lazy(() => import('./pages/DataMigrationWizard'));
const ImportHistoryDashboard = lazy(() => import('./pages/ImportHistoryDashboard'));
const SLAAutomationBuilder = lazy(() => import('./pages/SLAAutomationBuilder'));
const EscalationConsole = lazy(() => import('./pages/EscalationConsole'));

const SystemHealthDashboard = lazy(() => import('./pages/SystemHealthDashboard'));
const QueueMonitoringConsole = lazy(() => import('./pages/QueueMonitoringConsole'));
const ErrorAnalyticsDashboard = lazy(() => import('./pages/ErrorAnalyticsDashboard'));

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

import { MainLayout } from './components/layout/MainLayout';

function App() {
  return (
    <ErrorBoundary>
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
              <Route path="/sla/builder" element={<ProtectedRoute><MainLayout><SLAAutomationBuilder /></MainLayout></ProtectedRoute>} />
              <Route path="/sla/escalations" element={<ProtectedRoute><MainLayout><EscalationConsole /></MainLayout></ProtectedRoute>} />
              
              <Route path="/observability/health" element={<ProtectedRoute><MainLayout><SystemHealthDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/observability/queues" element={<ProtectedRoute><MainLayout><QueueMonitoringConsole /></MainLayout></ProtectedRoute>} />
              <Route path="/observability/api-errors" element={<ProtectedRoute><MainLayout><ErrorAnalyticsDashboard /></MainLayout></ProtectedRoute>} />
              
              <Route path="/data-migration/wizard" element={<ProtectedRoute><MainLayout><DataMigrationWizard /></MainLayout></ProtectedRoute>} />
              <Route path="/data-migration/history" element={<ProtectedRoute><MainLayout><ImportHistoryDashboard /></MainLayout></ProtectedRoute>} />

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
              <Route path="/vendors/intelligence" element={<ProtectedRoute><MainLayout><VendorIntelligence /></MainLayout></ProtectedRoute>} />
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
              <Route path="/invoices/smart-ingestion" element={<ProtectedRoute><MainLayout><SmartInvoiceIngestion /></MainLayout></ProtectedRoute>} />
              <Route path="/invoices/:id" element={<ProtectedRoute><MainLayout><InvoiceDetailWorkspace /></MainLayout></ProtectedRoute>} />
              
              <Route path="/finance/liabilities" element={<ProtectedRoute><MainLayout><APLiabilityDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/ledger" element={<ProtectedRoute><MainLayout><LedgerExplorer /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/tally" element={<ProtectedRoute><MainLayout><TallySyncQueue /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/tally/mapping" element={<ProtectedRoute><MainLayout><TallyMappingUI /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/tally/reconciliation" element={<ProtectedRoute><MainLayout><TallyReconciliationConsole /></MainLayout></ProtectedRoute>} />
              <Route path="/integrations" element={<ProtectedRoute><MainLayout><IntegrationHub /></MainLayout></ProtectedRoute>} />
              
              <Route path="/inventory" element={<ProtectedRoute><MainLayout><WarehouseDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/ledger" element={<ProtectedRoute><MainLayout><StockLedgerList /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/adjust" element={<ProtectedRoute><MainLayout><StockAdjustment /></MainLayout></ProtectedRoute>} />
              
              <Route path="/" element={<ProtectedRoute><MainLayout><Navigate to="/analytics" replace /></MainLayout></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </Router>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </ErrorBoundary>
  );
}

export default App;
