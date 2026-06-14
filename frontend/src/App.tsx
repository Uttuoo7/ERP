import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardSkeleton from './components/DashboardSkeleton';
import NotificationDropdown from './components/NotificationDropdown';
import { useAuthStore } from "./store/authStore";
import CommandPalette from './components/CommandPalette';

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
const ApprovalWorkCenter = lazy(() => import('./pages/ApprovalWorkCenter'));
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
const InventoryTransactionLedger = lazy(() => import('./pages/inventory/InventoryTransactionLedger'));
const InventoryIssues = lazy(() => import('./pages/inventory/InventoryIssues'));
const InventoryLedger = lazy(() => import('./pages/inventory/InventoryLedger'));
const InventoryTurnover = lazy(() => import('./pages/inventory/InventoryTurnover'));
const InventoryClosingCertificate = lazy(() => import('./pages/inventory/InventoryClosingCertificate'));
const InventoryConsumptionReport = lazy(() => import('./pages/inventory/InventoryConsumptionReport'));
const AdjustmentManagement = lazy(() => import('./pages/inventory/AdjustmentManagement'));
const TransferManagement = lazy(() => import('./pages/inventory/TransferManagement'));
const CycleCountManagement = lazy(() => import('./pages/inventory/CycleCountManagement'));
const InventoryValuation = lazy(() => import('./pages/inventory/InventoryValuation'));
const InventoryRevaluations = lazy(() => import('./pages/inventory/InventoryRevaluations'));
const InventorySnapshots = lazy(() => import('./pages/inventory/InventorySnapshots'));
const InventoryAnalytics = lazy(() => import('./pages/inventory/InventoryAnalytics'));
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
const ProcurementCommandCenter = lazy(() => import('./pages/ProcurementCommandCenter'));

// Finance Core (General Ledger) Pages
const FinanceDashboard = lazy(() => import('./pages/finance/FinanceDashboard'));
const ChartOfAccounts = lazy(() => import('./pages/finance/ChartOfAccounts'));
const JournalEntries = lazy(() => import('./pages/finance/JournalEntries'));
const FinancialReports = lazy(() => import('./pages/finance/FinancialReports'));

// Finance Reporting (Phase 11) Pages
const FinanceBalanceSheet = lazy(() => import('./pages/finance/FinanceBalanceSheet'));
const ProfitAndLoss = lazy(() => import('./pages/finance/ProfitAndLoss'));
const CashFlowStatement = lazy(() => import('./pages/finance/CashFlowStatement'));
const FinanceHealthDashboard = lazy(() => import('./pages/finance/FinanceHealthDashboard'));
const APReconciliation = lazy(() => import('./pages/finance/APReconciliation'));
const GRNIReconciliation = lazy(() => import('./pages/finance/GRNIReconciliation'));

// Manufacturing Pages (Phase 14)
const ManufacturingDashboard = lazy(() => import('./pages/manufacturing/ManufacturingDashboard').then(module => ({ default: module.ManufacturingDashboard })));
const WorkOrders = lazy(() => import('./pages/manufacturing/WorkOrders'));
const BOMManagement = lazy(() => import('./pages/manufacturing/BOMManagement'));
const RoutingManagement = lazy(() => import('./pages/manufacturing/RoutingManagement'));
const WorkCenters = lazy(() => import('./pages/manufacturing/WorkCenters'));
const ShopFloorExecution = lazy(() => import('./pages/manufacturing/ShopFloorExecution'));
const WIPValuation = lazy(() => import('./pages/manufacturing/WIPValuation'));
const ProductionVariance = lazy(() => import('./pages/manufacturing/ProductionVariance'));
const ManufacturingReports = lazy(() => import('./pages/manufacturing/ManufacturingReports'));

// Manufacturing Pages (Phase 15 APS)
const CapacityPlanning = lazy(() => import('./pages/manufacturing/CapacityPlanning'));
const ProductionScheduling = lazy(() => import('./pages/manufacturing/ProductionScheduling'));
const WorkCenterLoad = lazy(() => import('./pages/manufacturing/WorkCenterLoad'));
const BottleneckAnalysis = lazy(() => import('./pages/manufacturing/BottleneckAnalysis'));
const ScheduleOptimizer = lazy(() => import('./pages/manufacturing/ScheduleOptimizer'));

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

import { MainLayout } from './components/layout/MainLayout';
import VendorPortalRoutes from './routes/VendorPortalRoutes';

function App() {
  return (
    <ErrorBoundary>
        <Router>
          <Suspense fallback={<DashboardSkeleton />}>
            {/* Global Command Palette – mounted inside Router for useNavigate */}
            <CommandPalette />
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* ─── Vendor Portal (isolated layout & routes) ─── */}
              <Route path="/portal/*" element={<VendorPortalRoutes />} />
              
              <Route path="/analytics" element={<ProtectedRoute><MainLayout><AnalyticsDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/command-center" element={<ProtectedRoute><MainLayout><ProcurementCommandCenter /></MainLayout></ProtectedRoute>} />
              <Route path="/masters" element={<ProtectedRoute><MainLayout><MasterManager /></MainLayout></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><MainLayout><ApprovalWorkCenter /></MainLayout></ProtectedRoute>} />
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
              <Route path="/finance/dashboard" element={<ProtectedRoute><MainLayout><FinanceDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/coa" element={<ProtectedRoute><MainLayout><ChartOfAccounts /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/journals" element={<ProtectedRoute><MainLayout><JournalEntries /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/reports" element={<ProtectedRoute><MainLayout><FinancialReports /></MainLayout></ProtectedRoute>} />
              
              {/* Finance Reporting (Phase 11) Routes */}
              <Route path="/finance/balance-sheet" element={<ProtectedRoute><MainLayout><FinanceBalanceSheet /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/profit-loss" element={<ProtectedRoute><MainLayout><ProfitAndLoss /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/cash-flow" element={<ProtectedRoute><MainLayout><CashFlowStatement /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/health" element={<ProtectedRoute><MainLayout><FinanceHealthDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/ap-reconciliation" element={<ProtectedRoute><MainLayout><APReconciliation /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/grni-reconciliation" element={<ProtectedRoute><MainLayout><GRNIReconciliation /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/tally" element={<ProtectedRoute><MainLayout><TallySyncQueue /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/tally/mapping" element={<ProtectedRoute><MainLayout><TallyMappingUI /></MainLayout></ProtectedRoute>} />
              <Route path="/finance/tally/reconciliation" element={<ProtectedRoute><MainLayout><TallyReconciliationConsole /></MainLayout></ProtectedRoute>} />
              <Route path="/integrations" element={<ProtectedRoute><MainLayout><IntegrationHub /></MainLayout></ProtectedRoute>} />
              
              <Route path="/inventory" element={<ProtectedRoute><MainLayout><WarehouseDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/valuation" element={<ProtectedRoute><MainLayout><InventoryValuation /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/revaluations" element={<ProtectedRoute><MainLayout><InventoryRevaluations /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/snapshots" element={<ProtectedRoute><MainLayout><InventorySnapshots /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/analytics" element={<ProtectedRoute><MainLayout><InventoryAnalytics /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/ledger" element={<ProtectedRoute><MainLayout><InventoryLedger /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/issues" element={<ProtectedRoute><MainLayout><InventoryIssues /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/turnover" element={<ProtectedRoute><MainLayout><InventoryTurnover /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/closing-certificate" element={<ProtectedRoute><MainLayout><InventoryClosingCertificate /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/consumption" element={<ProtectedRoute><MainLayout><InventoryConsumptionReport /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/adjust" element={<ProtectedRoute><MainLayout><AdjustmentManagement /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/transfers" element={<ProtectedRoute><MainLayout><TransferManagement /></MainLayout></ProtectedRoute>} />
              <Route path="/inventory/cycle-counts" element={<ProtectedRoute><MainLayout><CycleCountManagement /></MainLayout></ProtectedRoute>} />
              
              {/* Manufacturing Routes */}
              <Route path="/manufacturing/dashboard" element={<ProtectedRoute><MainLayout><ManufacturingDashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/work-orders" element={<ProtectedRoute><MainLayout><WorkOrders /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/boms" element={<ProtectedRoute><MainLayout><BOMManagement /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/routings" element={<ProtectedRoute><MainLayout><RoutingManagement /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/work-centers" element={<ProtectedRoute><MainLayout><WorkCenters /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/shop-floor" element={<ProtectedRoute><MainLayout><ShopFloorExecution /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/wip" element={<ProtectedRoute><MainLayout><WIPValuation /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/variance" element={<ProtectedRoute><MainLayout><ProductionVariance /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/reports" element={<ProtectedRoute><MainLayout><ManufacturingReports /></MainLayout></ProtectedRoute>} />
              
              {/* Phase 15 APS Routes */}
              <Route path="/manufacturing/capacity-planning" element={<ProtectedRoute><MainLayout><CapacityPlanning /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/production-scheduling" element={<ProtectedRoute><MainLayout><ProductionScheduling /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/work-center-load" element={<ProtectedRoute><MainLayout><WorkCenterLoad /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/bottlenecks" element={<ProtectedRoute><MainLayout><BottleneckAnalysis /></MainLayout></ProtectedRoute>} />
              <Route path="/manufacturing/optimizer" element={<ProtectedRoute><MainLayout><ScheduleOptimizer /></MainLayout></ProtectedRoute>} />
              
              <Route path="/" element={<ProtectedRoute><MainLayout><Navigate to="/analytics" replace /></MainLayout></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </Router>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </ErrorBoundary>
  );
}

export default App;
