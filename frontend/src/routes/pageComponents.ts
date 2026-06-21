import { lazy } from 'react';

export interface TabRouteDefinition {
  pattern: RegExp;
  pathTemplate: string;
  component: React.ComponentType<any>;
}

export const TAB_ROUTE_MAP: TabRouteDefinition[] = [
  { pattern: /^\/dashboard$/, pathTemplate: '/dashboard', component: lazy(() => import('../pages/dashboard/RoleDashboard')) },
  { pattern: /^\/analytics$/, pathTemplate: '/analytics', component: lazy(() => import('../pages/AnalyticsDashboard')) },
  { pattern: /^\/command-center$/, pathTemplate: '/command-center', component: lazy(() => import('../pages/ProcurementCommandCenter')) },
  { pattern: /^\/masters$/, pathTemplate: '/masters', component: lazy(() => import('../pages/MasterManager')) },
  { pattern: /^\/wizards$/, pathTemplate: '/wizards', component: lazy(() => import('../pages/wizards/WorkflowWizards')) },
  { pattern: /^\/inbox$/, pathTemplate: '/inbox', component: lazy(() => import('../pages/ApprovalWorkCenter')) },
  { pattern: /^\/workflows\/builder$/, pathTemplate: '/workflows/builder', component: lazy(() => import('../pages/WorkflowBuilder')) },
  { pattern: /^\/rbac\/matrix$/, pathTemplate: '/rbac/matrix', component: lazy(() => import('../pages/RBACMatrixManager')) },
  { pattern: /^\/notifications$/, pathTemplate: '/notifications', component: lazy(() => import('../pages/NotificationCenter')) },
  { pattern: /^\/sla\/builder$/, pathTemplate: '/sla/builder', component: lazy(() => import('../pages/SLAAutomationBuilder')) },
  { pattern: /^\/sla\/escalations$/, pathTemplate: '/sla/escalations', component: lazy(() => import('../pages/EscalationConsole')) },
  { pattern: /^\/admin\/platform$/, pathTemplate: '/admin/platform', component: lazy(() => import('../pages/PlatformAdministrationCenter')) },
  { pattern: /^\/settings$/, pathTemplate: '/settings', component: lazy(() => import('../pages/SettingsCenter')) },
  
  { pattern: /^\/observability\/health$/, pathTemplate: '/observability/health', component: lazy(() => import('../pages/SystemHealthDashboard')) },
  { pattern: /^\/observability\/queues$/, pathTemplate: '/observability/queues', component: lazy(() => import('../pages/QueueMonitoringConsole')) },
  { pattern: /^\/observability\/api-errors$/, pathTemplate: '/observability/api-errors', component: lazy(() => import('../pages/ErrorAnalyticsDashboard')) },
  
  { pattern: /^\/data-migration\/wizard$/, pathTemplate: '/data-migration/wizard', component: lazy(() => import('../pages/DataMigrationWizard')) },
  { pattern: /^\/data-migration\/history$/, pathTemplate: '/data-migration/history', component: lazy(() => import('../pages/ImportHistoryDashboard')) },
  
  { pattern: /^\/requisitions$/, pathTemplate: '/requisitions', component: lazy(() => import('../pages/PRList')) },
  { pattern: /^\/requisitions\/new$/, pathTemplate: '/requisitions/new', component: lazy(() => import('../pages/PRForm')) },
  { pattern: /^\/requisitions\/([^\/]+)\/edit$/, pathTemplate: '/requisitions/:id/edit', component: lazy(() => import('../pages/PRForm')) },
  { pattern: /^\/requisitions\/([^\/]+)$/, pathTemplate: '/requisitions/:id', component: lazy(() => import('../pages/PRDetails')) },
  
  { pattern: /^\/rfqs$/, pathTemplate: '/rfqs', component: lazy(() => import('../pages/RFQList')) },
  { pattern: /^\/rfqs\/new$/, pathTemplate: '/rfqs/new', component: lazy(() => import('../pages/RFQForm')) },
  { pattern: /^\/rfqs\/([^\/]+)\/compare$/, pathTemplate: '/rfqs/:id/compare', component: lazy(() => import('../pages/RFQCompare')) },
  { pattern: /^\/rfqs\/([^\/]+)$/, pathTemplate: '/rfqs/:id', component: lazy(() => import('../pages/RFQDetails')) },
  
  { pattern: /^\/sales-orders$/, pathTemplate: '/sales-orders', component: lazy(() => import('../pages/SOList')) },
  { pattern: /^\/sales-orders\/new$/, pathTemplate: '/sales-orders/new', component: lazy(() => import('../pages/SOForm')) },
  { pattern: /^\/sales-orders\/([^\/]+)$/, pathTemplate: '/sales-orders/:id', component: lazy(() => import('../pages/SODetails')) },
  
  { pattern: /^\/vendors$/, pathTemplate: '/vendors', component: lazy(() => import('../pages/VendorList')) },
  { pattern: /^\/vendors\/intelligence$/, pathTemplate: '/vendors/intelligence', component: lazy(() => import('../pages/VendorIntelligence')) },
  { pattern: /^\/items$/, pathTemplate: '/items', component: lazy(() => import('../pages/ItemCatalog')) },
  
  { pattern: /^\/pos$/, pathTemplate: '/pos', component: lazy(() => import('../pages/POList')) },
  { pattern: /^\/pos\/new$/, pathTemplate: '/pos/new', component: lazy(() => import('../pages/PurchaseOrderForm')) },
  { pattern: /^\/pos\/convert$/, pathTemplate: '/pos/convert', component: lazy(() => import('../pages/POConverter')) },
  { pattern: /^\/pos\/([^\/]+)$/, pathTemplate: '/pos/:id', component: lazy(() => import('../pages/PODetails')) },
  { pattern: /^\/pos\/([^\/]+)\/edit$/, pathTemplate: '/pos/:id/edit', component: lazy(() => import('../pages/PurchaseOrderEdit')) },
  
  { pattern: /^\/grns$/, pathTemplate: '/grns', component: lazy(() => import('../pages/GRNList')) },
  { pattern: /^\/grns\/convert$/, pathTemplate: '/grns/convert', component: lazy(() => import('../pages/POToGRNConverter')) },
  { pattern: /^\/grns\/([^\/]+)$/, pathTemplate: '/grns/:id', component: lazy(() => import('../pages/GRNDetails')) },
  { pattern: /^\/grns\/([^\/]+)\/qc$/, pathTemplate: '/grns/:id/qc', component: lazy(() => import('../pages/QCConsole')) },
  { pattern: /^\/receive-goods$/, pathTemplate: '/receive-goods', component: lazy(() => import('../pages/ReceiveGoods')) },
  
  { pattern: /^\/invoices$/, pathTemplate: '/invoices', component: lazy(() => import('../pages/InvoiceDashboard')) },
  { pattern: /^\/invoices\/new$/, pathTemplate: '/invoices/new', component: lazy(() => import('../pages/InvoiceEntryWorkspace')) },
  { pattern: /^\/invoices\/smart-ingestion$/, pathTemplate: '/invoices/smart-ingestion', component: lazy(() => import('../pages/SmartInvoiceIngestion')) },
  { pattern: /^\/invoices\/([^\/]+)$/, pathTemplate: '/invoices/:id', component: lazy(() => import('../pages/InvoiceDetailWorkspace')) },
  
  { pattern: /^\/finance\/liabilities$/, pathTemplate: '/finance/liabilities', component: lazy(() => import('../pages/APLiabilityDashboard')) },
  { pattern: /^\/finance\/ledger$/, pathTemplate: '/finance/ledger', component: lazy(() => import('../pages/LedgerExplorer')) },
  { pattern: /^\/finance\/dashboard$/, pathTemplate: '/finance/dashboard', component: lazy(() => import('../pages/finance/FinanceDashboard')) },
  { pattern: /^\/finance\/coa$/, pathTemplate: '/finance/coa', component: lazy(() => import('../pages/finance/ChartOfAccounts')) },
  { pattern: /^\/finance\/journals$/, pathTemplate: '/finance/journals', component: lazy(() => import('../pages/finance/JournalEntries')) },
  { pattern: /^\/finance\/reports$/, pathTemplate: '/finance/reports', component: lazy(() => import('../pages/finance/FinancialReports')) },
  
  { pattern: /^\/finance\/balance-sheet$/, pathTemplate: '/finance/balance-sheet', component: lazy(() => import('../pages/finance/FinanceBalanceSheet')) },
  { pattern: /^\/finance\/profit-loss$/, pathTemplate: '/finance/profit-loss', component: lazy(() => import('../pages/finance/ProfitAndLoss')) },
  { pattern: /^\/finance\/cash-flow$/, pathTemplate: '/finance/cash-flow', component: lazy(() => import('../pages/finance/CashFlowStatement')) },
  { pattern: /^\/finance\/health$/, pathTemplate: '/finance/health', component: lazy(() => import('../pages/finance/FinanceHealthDashboard')) },
  { pattern: /^\/finance\/ap-reconciliation$/, pathTemplate: '/finance/ap-reconciliation', component: lazy(() => import('../pages/finance/APReconciliation')) },
  { pattern: /^\/finance\/grni-reconciliation$/, pathTemplate: '/finance/grni-reconciliation', component: lazy(() => import('../pages/finance/GRNIReconciliation')) },
  { pattern: /^\/finance\/tally$/, pathTemplate: '/finance/tally', component: lazy(() => import('../pages/TallySyncQueue')) },
  { pattern: /^\/finance\/tally\/mapping$/, pathTemplate: '/finance/tally/mapping', component: lazy(() => import('../pages/TallyMappingUI')) },
  { pattern: /^\/finance\/tally\/reconciliation$/, pathTemplate: '/finance/tally/reconciliation', component: lazy(() => import('../pages/TallyReconciliationConsole')) },
  { pattern: /^\/integrations$/, pathTemplate: '/integrations', component: lazy(() => import('../pages/IntegrationHub')) },
  
  { pattern: /^\/inventory$/, pathTemplate: '/inventory', component: lazy(() => import('../pages/WarehouseDashboard')) },
  { pattern: /^\/inventory\/valuation$/, pathTemplate: '/inventory/valuation', component: lazy(() => import('../pages/inventory/InventoryValuation')) },
  { pattern: /^\/inventory\/revaluations$/, pathTemplate: '/inventory/revaluations', component: lazy(() => import('../pages/inventory/InventoryRevaluations')) },
  { pattern: /^\/inventory\/snapshots$/, pathTemplate: '/inventory/snapshots', component: lazy(() => import('../pages/inventory/InventorySnapshots')) },
  { pattern: /^\/inventory\/analytics$/, pathTemplate: '/inventory/analytics', component: lazy(() => import('../pages/inventory/InventoryAnalytics')) },
  { pattern: /^\/inventory\/ledger$/, pathTemplate: '/inventory/ledger', component: lazy(() => import('../pages/inventory/InventoryLedger')) },
  { pattern: /^\/inventory\/issues$/, pathTemplate: '/inventory/issues', component: lazy(() => import('../pages/inventory/InventoryIssues')) },
  { pattern: /^\/inventory\/turnover$/, pathTemplate: '/inventory/turnover', component: lazy(() => import('../pages/inventory/InventoryTurnover')) },
  { pattern: /^\/inventory\/closing-certificate$/, pathTemplate: '/inventory/closing-certificate', component: lazy(() => import('../pages/inventory/InventoryClosingCertificate')) },
  { pattern: /^\/inventory\/consumption$/, pathTemplate: '/inventory/consumption', component: lazy(() => import('../pages/inventory/InventoryConsumptionReport')) },
  { pattern: /^\/inventory\/adjust$/, pathTemplate: '/inventory/adjust', component: lazy(() => import('../pages/inventory/AdjustmentManagement')) },
  { pattern: /^\/inventory\/transfers$/, pathTemplate: '/inventory/transfers', component: lazy(() => import('../pages/inventory/TransferManagement')) },
  { pattern: /^\/inventory\/cycle-counts$/, pathTemplate: '/inventory/cycle-counts', component: lazy(() => import('../pages/inventory/CycleCountManagement')) },
  
  { pattern: /^\/manufacturing\/dashboard$/, pathTemplate: '/manufacturing/dashboard', component: lazy(() => import('../pages/manufacturing/ManufacturingDashboard').then(m => ({ default: m.ManufacturingDashboard }))) },
  { pattern: /^\/manufacturing\/work-orders$/, pathTemplate: '/manufacturing/work-orders', component: lazy(() => import('../pages/manufacturing/WorkOrders')) },
  { pattern: /^\/manufacturing\/boms$/, pathTemplate: '/manufacturing/boms', component: lazy(() => import('../pages/manufacturing/BOMManagement')) },
  { pattern: /^\/manufacturing\/routings$/, pathTemplate: '/manufacturing/routings', component: lazy(() => import('../pages/manufacturing/RoutingManagement')) },
  { pattern: /^\/manufacturing\/work-centers$/, pathTemplate: '/manufacturing/work-centers', component: lazy(() => import('../pages/manufacturing/WorkCenters')) },
  { pattern: /^\/manufacturing\/shop-floor$/, pathTemplate: '/manufacturing/shop-floor', component: lazy(() => import('../pages/manufacturing/ShopFloorExecution')) },
  { pattern: /^\/manufacturing\/wip$/, pathTemplate: '/manufacturing/wip', component: lazy(() => import('../pages/manufacturing/WIPValuation')) },
  { pattern: /^\/manufacturing\/variance$/, pathTemplate: '/manufacturing/variance', component: lazy(() => import('../pages/manufacturing/ProductionVariance')) },
  { pattern: /^\/manufacturing\/reports$/, pathTemplate: '/manufacturing/reports', component: lazy(() => import('../pages/manufacturing/ManufacturingReports')) },
  
  { pattern: /^\/manufacturing\/capacity-planning$/, pathTemplate: '/manufacturing/capacity-planning', component: lazy(() => import('../pages/manufacturing/CapacityPlanning')) },
  { pattern: /^\/manufacturing\/production-scheduling$/, pathTemplate: '/manufacturing/production-scheduling', component: lazy(() => import('../pages/manufacturing/ProductionScheduling')) },
  { pattern: /^\/manufacturing\/work-center-load$/, pathTemplate: '/manufacturing/work-center-load', component: lazy(() => import('../pages/manufacturing/WorkCenterLoad')) },
  { pattern: /^\/manufacturing\/bottlenecks$/, pathTemplate: '/manufacturing/bottlenecks', component: lazy(() => import('../pages/manufacturing/BottleneckAnalysis')) },
  { pattern: /^\/manufacturing\/optimizer$/, pathTemplate: '/manufacturing/optimizer', component: lazy(() => import('../pages/manufacturing/ScheduleOptimizer')) }
];

export const getComponentForPath = (path: string): React.ComponentType<any> | null => {
  const cleanPath = path === '/' ? '/dashboard' : path;
  const match = TAB_ROUTE_MAP.find(route => route.pattern.test(cleanPath));
  return match ? match.component : null;
};
