export interface RouteConfig {
  path: string;
  module: string;
  title: string;
  description?: string;
  icon: string;
  roles: string[]; // Access control roles
  searchable: boolean;
  breadcrumbs?: { label: string; path?: string }[];
}

export const ERP_ROUTES: RouteConfig[] = [
  // --- WORKPLACE ---
  {
    path: "/inbox",
    module: "Workplace",
    title: "Enterprise Approval Work Center",
    description: "Fiori-grade approval inbox with bulk actions",
    icon: "Inbox",
    roles: ["EMPLOYEE", "PROCUREMENT_MANAGER", "FINANCE_MANAGER", "WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN", "BUYER"],
    searchable: true
  },
  {
    path: "/notifications",
    module: "Workplace",
    title: "My Alerts Feed",
    description: "System notifications and automated alerts",
    icon: "Bell",
    roles: ["EMPLOYEE", "PROCUREMENT_MANAGER", "FINANCE_MANAGER", "WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN", "BUYER"],
    searchable: true
  },
  {
    path: "/wizards",
    module: "Workplace",
    title: "Guided Workflow Wizards",
    description: "End-to-end guided operational path wizards",
    icon: "Workflow",
    roles: ["EMPLOYEE", "PROCUREMENT_MANAGER", "FINANCE_MANAGER", "WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN", "BUYER"],
    searchable: true
  },

  // --- DASHBOARDS / INSIGHTS ---
  {
    path: "/command-center",
    module: "Insights",
    title: "Procurement Command Center",
    description: "Executive operational overview and procurement pipeline",
    icon: "LayoutDashboard",
    roles: ["PROCUREMENT_MANAGER", "BUYER", "ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER"],
    searchable: true,
    breadcrumbs: [{ label: 'Insights' }, { label: 'Procurement Command Center' }]
  },
  {
    path: "/analytics",
    module: "Insights",
    title: "Command Cockpit",
    description: "Executive insights and operational metrics",
    icon: "BarChart3",
    roles: ["PROCUREMENT_MANAGER", "BUYER", "ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Insights' }, { label: 'Command Cockpit' }]
  },

  // --- PURCHASING & RFQ ---
  {
    path: "/requisitions",
    module: "Purchasing & RFQ",
    title: "Purchase Requisitions",
    description: "Internal requests for goods and services",
    icon: "FileText",
    roles: ["EMPLOYEE", "PROCUREMENT_MANAGER", "BUYER", "ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Procurement', path: '/requisitions' }, { label: 'Requisitions' }]
  },
  {
    path: "/rfqs",
    module: "Purchasing & RFQ",
    title: "Requests For Quotations",
    description: "Manage supplier bids and competitive quotes",
    icon: "ClipboardList",
    roles: ["PROCUREMENT_MANAGER", "BUYER", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/vendors",
    module: "Purchasing & RFQ",
    title: "Vendors Registry",
    description: "Manage supplier relationships and performance",
    icon: "Users",
    roles: ["PROCUREMENT_MANAGER", "BUYER", "ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Master Data', path: '/masters' }, { label: 'Vendors' }]
  },
  {
    path: "/pos",
    module: "Purchasing & RFQ",
    title: "Purchase Orders",
    description: "Manage supplier commitments and approvals",
    icon: "FileSignature",
    roles: ["PROCUREMENT_MANAGER", "BUYER", "ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Procurement', path: '/pos' }, { label: 'Purchase Orders' }]
  },

  // --- WAREHOUSE & RECEIPTS ---
  {
    path: "/inventory",
    module: "Warehouse & Receipts",
    title: "Universal Warehouse Dashboard",
    description: "Real-time inventory levels and batch tracking",
    icon: "Boxes",
    roles: ["WAREHOUSE_MANAGER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Dashboard' }]
  },
  {
    path: "/inventory/valuation",
    module: "Warehouse & Receipts",
    title: "Inventory Valuation",
    description: "Grouped quantities, average unit costs, and total valued assets by warehouse/category",
    icon: "Calculator",
    roles: ["WAREHOUSE_MANAGER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER", "FINANCE"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Valuation' }]
  },
  {
    path: "/inventory/revaluations",
    module: "Warehouse & Receipts",
    title: "Inventory Revaluation",
    description: "Propose, approve, and track costing adjustments and standard rates",
    icon: "Coins",
    roles: ["WAREHOUSE_MANAGER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Revaluations' }]
  },
  {
    path: "/inventory/snapshots",
    module: "Warehouse & Receipts",
    title: "Inventory Snapshots",
    description: "Generate, explore, and restore historical inventory states",
    icon: "Camera",
    roles: ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Snapshots' }]
  },
  {
    path: "/inventory/analytics",
    module: "Warehouse & Receipts",
    title: "Inventory Analytics",
    description: "Turnover, aging analysis, dead stock detection, and warehouse trends",
    icon: "TrendingUp",
    roles: ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Analytics' }]
  },
  {
    path: "/grns",
    module: "Warehouse & Receipts",
    title: "Warehouse Receipts (GRN)",
    description: "Track incoming shipments and quality control",
    icon: "Truck",
    roles: ["WAREHOUSE_MANAGER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/inventory/transfers",
    module: "Warehouse & Receipts",
    title: "Stock Transfers",
    description: "Request, dispatch, and receive stock transfers",
    icon: "Navigation",
    roles: ["WAREHOUSE_MANAGER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Transfers' }]
  },
  {
    path: "/inventory/cycle-counts",
    module: "Warehouse & Receipts",
    title: "Cycle Counts & Audits",
    description: "Initialize, enter, and approve physical stock audits",
    icon: "ClipboardCheck",
    roles: ["WAREHOUSE_MANAGER", "WAREHOUSE", "ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Cycle Counts' }]
  },
  {
    path: "/inventory/adjust",
    module: "Warehouse & Receipts",
    title: "Stock Adjustments",
    description: "Propose, submit, and approve stock adjustments",
    icon: "ShieldAlert",
    roles: ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Adjustments' }]
  },
  {
    path: "/inventory/ledger",
    module: "Warehouse & Receipts",
    title: "Canonical Movement Ledger",
    description: "Explorer portal for the unified movement ledger",
    icon: "BookOpen",
    roles: ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER", "FINANCE"],
    searchable: true,
    breadcrumbs: [{ label: 'Warehouse', path: '/inventory' }, { label: 'Movement Ledger' }]
  },

  // --- ACCOUNTS PAYABLE ---
  {
    path: "/invoices",
    module: "Accounts Payable",
    title: "Vendor Invoices",
    description: "Manage supplier invoice lifecycle and approvals",
    icon: "Receipt",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/liabilities",
    module: "Accounts Payable",
    title: "Accrued Liabilities",
    description: "Track AP aging and unbilled payables",
    icon: "Landmark",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/ledger",
    module: "Accounts Payable",
    title: "G/L Postings Explorer",
    description: "General ledger entries and accounting traces",
    icon: "BookOpen",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/tally",
    module: "Accounts Payable",
    title: "Tally ERP Queue",
    description: "Monitor sync queue with external Tally systems",
    icon: "RefreshCw",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: false
  },
  {
    path: "/finance/tally/mapping",
    module: "Accounts Payable",
    title: "Tally Ledger Mapping",
    description: "Configure chart of accounts mappings",
    icon: "GitMerge",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: false
  },
  {
    path: "/finance/tally/reconciliation",
    module: "Accounts Payable",
    title: "Tally Reconciliation",
    description: "Reconcile differences between ERP and Tally",
    icon: "CheckSquare",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: false
  },
  
  // --- GENERAL LEDGER CORE ---
  {
    path: "/finance/dashboard",
    module: "General Ledger Core",
    title: "Finance KPI Dashboard",
    description: "Financial performance indicators and cash position",
    icon: "LayoutDashboard",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/coa",
    module: "General Ledger Core",
    title: "Chart of Accounts",
    description: "Manage G/L accounts and accounting period locks",
    icon: "FolderTree",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/journals",
    module: "General Ledger Core",
    title: "Manual Journal Workspace",
    description: "Post manual double-entry journals and audit trail",
    icon: "PenTool",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/reports",
    module: "General Ledger Core",
    title: "Financial Reports",
    description: "Trial Balance, General Ledger and Account Ledgers",
    icon: "FileSpreadsheet",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },

  // --- FINANCE REPORTING ---
  {
    path: "/finance/health",
    module: "Finance Reporting",
    title: "Financial Governance",
    description: "Trial Balance status, unposted transactions, and core reconciliations",
    icon: "Heart",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/balance-sheet",
    module: "Finance Reporting",
    title: "Balance Sheet",
    description: "Dynamic Assets, Liabilities, and Equity overview",
    icon: "Scale",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/profit-loss",
    module: "Finance Reporting",
    title: "Profit & Loss",
    description: "Revenue, Expenses, and Operating Margins",
    icon: "TrendingUp",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/cash-flow",
    module: "Finance Reporting",
    title: "Cash Flow Statement",
    description: "Indirect cash flows and movement reconciliation",
    icon: "DollarSign",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/ap-reconciliation",
    module: "Finance Reporting",
    title: "AP Reconciliation",
    description: "AP G/L Control vs Vendor Liabilities",
    icon: "CheckSquare",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/finance/grni-reconciliation",
    module: "Finance Reporting",
    title: "GRNI Reconciliation",
    description: "GRNI G/L Control vs Uninvoiced Goods Receipts",
    icon: "Layers",
    roles: ["FINANCE_MANAGER", "FINANCE", "ADMIN", "SUPER_ADMIN"],
    searchable: true
  },

  // --- ADMINISTRATION ---
  {
    path: "/masters",
    module: "Administration",
    title: "Master Data Engine",
    description: "Centralized configuration for users, locations, and entities",
    icon: "Database",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Administration' }, { label: 'Master Data' }]
  },
  {
    path: "/admin/platform",
    module: "Administration",
    title: "Platform Administration Center",
    description: "Configure plugin state, feature flags, compatibility validations and diagnostics",
    icon: "Cpu",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true,
    breadcrumbs: [{ label: 'Administration' }, { label: 'Platform Administration' }]
  },
  {
    path: "/settings",
    module: "Administration",
    title: "Settings Center",
    description: "Personalization, appearance themes, tables density, workspaces and notification rules",
    icon: "Settings",
    roles: ["EMPLOYEE", "PROCUREMENT_MANAGER", "FINANCE_MANAGER", "WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN", "BUYER"],
    searchable: true,
    breadcrumbs: [{ label: 'Administration' }, { label: 'Settings Center' }]
  },
  {
    path: "/workflows/builder",
    module: "Administration",
    title: "Workflows Setup",
    description: "Build visual approval routing matrices",
    icon: "Workflow",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/sla/builder",
    module: "Administration",
    title: "SLA Automation Builder",
    description: "Configure service level agreements for turnaround times",
    icon: "Timer",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/sla/escalations",
    module: "Administration",
    title: "Escalation Console",
    description: "Monitor and manage breached SLAs",
    icon: "AlertTriangle",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/rbac/matrix",
    module: "Administration",
    title: "RBAC Roles Matrix",
    description: "Manage permissions and role assignments",
    icon: "Shield",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/integrations",
    module: "Administration",
    title: "Enterprise Integrations",
    description: "Manage API keys and external connections",
    icon: "Network",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/data-migration/wizard",
    module: "Administration",
    title: "Data Migration Wizard",
    description: "Bulk import records via CSV/Excel",
    icon: "UploadCloud",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/data-migration/history",
    module: "Administration",
    title: "Import Audit Logs",
    description: "Review past migration and import histories",
    icon: "History",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },

  // --- OBSERVABILITY ---
  {
    path: "/observability/health",
    module: "Observability",
    title: "System Health",
    description: "Live node monitoring and API performance metrics",
    icon: "Activity",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/observability/queues",
    module: "Observability",
    title: "Queue Monitor",
    description: "Monitor background processing tasks like emails or webhooks",
    icon: "List",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/observability/api-errors",
    module: "Observability",
    title: "Error Analytics",
    description: "Centralized system exceptions logging",
    icon: "Bug",
    roles: ["ADMIN", "SUPER_ADMIN"],
    searchable: true
  },
  {
    path: "/manufacturing/dashboard",
    module: "Manufacturing",
    title: "Manufacturing Dashboard",
    description: "Overview of production KPIs and shop floor metrics",
    icon: "LayoutDashboard",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/work-orders",
    module: "Manufacturing",
    title: "Work Orders",
    description: "Launch, release, and track work orders",
    icon: "ClipboardList",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER", "WAREHOUSE_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/boms",
    module: "Manufacturing",
    title: "Bill of Materials",
    description: "Manage and revise Bills of Materials",
    icon: "Settings",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/routings",
    module: "Manufacturing",
    title: "Routings",
    description: "Define sequencing of operations and run times",
    icon: "GitBranch",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/work-centers",
    module: "Manufacturing",
    title: "Work Centers",
    description: "Manage production locations and capacity calendar",
    icon: "Home",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/shop-floor",
    module: "Manufacturing",
    title: "Shop Floor Control",
    description: "Execution panel for operators to record steps",
    icon: "Cpu",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER", "WAREHOUSE_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/wip",
    module: "Manufacturing",
    title: "WIP Valuation",
    description: "Real-time WIP asset balances and subledger",
    icon: "DollarSign",
    roles: ["ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/variance",
    module: "Manufacturing",
    title: "Variance Analysis",
    description: "Analyze material, labor, and overhead variances",
    icon: "TrendingUp",
    roles: ["ADMIN", "SUPER_ADMIN", "FINANCE_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/reports",
    module: "Manufacturing",
    title: "Manufacturing Reports",
    description: "Production reports, yield, and recall genealogy",
    icon: "BarChart3",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER", "WAREHOUSE_MANAGER", "FINANCE_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/capacity-planning",
    module: "Manufacturing",
    title: "Capacity Horizons",
    description: "Create and execute finite capacity plans",
    icon: "Layers",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/production-scheduling",
    module: "Manufacturing",
    title: "Production Timeline",
    description: "Production Gantt and scheduled operations",
    icon: "Calendar",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/work-center-load",
    module: "Manufacturing",
    title: "Work Center Load",
    description: "Load vs Capacity heatmaps and utilization charts",
    icon: "Home",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/bottlenecks",
    module: "Manufacturing",
    title: "Bottleneck Analysis",
    description: "Monitor capacity exceptions, overloads and queues",
    icon: "ShieldAlert",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  },
  {
    path: "/manufacturing/optimizer",
    module: "Manufacturing",
    title: "Schedule Optimizer",
    description: "Optimize operations and run overtime simulations",
    icon: "Zap",
    roles: ["ADMIN", "SUPER_ADMIN", "PROCUREMENT_MANAGER"],
    searchable: true
  }
];

export const getRouteMetadata = (path: string): RouteConfig | null => {
  // Try exact match
  const exact = ERP_ROUTES.find(r => r.path === path);
  if (exact) return exact;

  // Extremely basic fallback for dynamic routes (e.g. /pos/123)
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 1) {
    const parentPath = `/${segments[0]}`;
    const parent = ERP_ROUTES.find(r => r.path === parentPath);
    if (parent) return parent;
  }
  
  return null;
};

// ─── MEGA MENU & RIBBON CONFIGURATION REGISTRY ───

export interface MegaMenuLink {
  label: string;
  path: string;
  roles?: string[];
  shortcut?: string;
}

export interface MegaMenuCardConfig {
  title: string;
  icon: string;
  description: string;
  links: MegaMenuLink[];
  pendingBadgeKey?: string;
}

export interface MegaMenuCategory {
  title: string;
  cards: MegaMenuCardConfig[];
}

export interface MegaMenuModule {
  id: string;
  title: string;
  icon: string;
  roles: string[];
  disabled?: boolean;
  categories?: MegaMenuCategory[];
}

export const MEGA_MENU_CONFIG: MegaMenuModule[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: 'LayoutDashboard',
    roles: ['EMPLOYEE', 'PROCUREMENT_MANAGER', 'FINANCE_MANAGER', 'WAREHOUSE_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'BUYER'],
    categories: []
  },
  {
    id: 'purchase',
    title: 'Purchase',
    icon: 'ShoppingBag',
    roles: ['PROCUREMENT_MANAGER', 'BUYER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'],
    categories: [
      {
        title: 'Procurement',
        cards: [
          {
            title: 'Purchase Requisitions',
            icon: 'FileText',
            description: 'Internal requisitions and purchase requests',
            links: [
              { label: 'Requisitions Feed', path: '/requisitions' },
              { label: 'New Requisition', path: '/requisitions/new', shortcut: 'Ctrl+Shift+R' }
            ]
          },
          {
            title: 'Requests for Quotes',
            icon: 'ClipboardList',
            description: 'Manage RFQs, supplier bids and comparisons',
            links: [
              { label: 'All RFQs', path: '/rfqs' },
              { label: 'Create RFQ', path: '/rfqs/new' }
            ]
          }
        ]
      },
      {
        title: 'Purchase Orders',
        cards: [
          {
            title: 'Purchase Orders',
            icon: 'FileSignature',
            description: 'Manage PO status, approval limits, and amendments',
            links: [
              { label: 'PO Registry', path: '/pos' },
              { label: 'New Purchase Order', path: '/pos/new', shortcut: 'Ctrl+Shift+P' },
              { label: 'Convert Requisition/RFQ', path: '/pos/convert' }
            ],
            pendingBadgeKey: 'pendingApprovals'
          }
        ]
      },
      {
        title: 'Receiving',
        cards: [
          {
            title: 'Goods Receipts (GRN)',
            icon: 'Truck',
            description: 'Dock receiving, line-item audits, and quality logs',
            links: [
              { label: 'Receipts Ledger', path: '/grns' },
              { label: 'Log New Shipment (GRN)', path: '/receive-goods' }
            ]
          }
        ]
      },
      {
        title: 'Masters',
        cards: [
          {
            title: 'Supplier Registry',
            icon: 'Users',
            description: 'Vendor master details and analytics',
            links: [
              { label: 'All Vendors', path: '/vendors' },
              { label: 'Vendor Intelligence', path: '/vendors/intelligence' }
            ]
          },
          {
            title: 'Items Catalog',
            icon: 'Boxes',
            description: 'Item master data database',
            links: [
              { label: 'Items Catalog', path: '/items' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: 'Boxes',
    roles: ['WAREHOUSE_MANAGER', 'WAREHOUSE', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'],
    categories: [
      {
        title: 'Warehouse Control',
        cards: [
          {
            title: 'Warehouse Dashboard',
            icon: 'LayoutDashboard',
            description: 'Real-time capacities, dead stock, and status',
            links: [
              { label: 'Main Control Panel', path: '/inventory' }
            ]
          },
          {
            title: 'Stock Movements',
            icon: 'Navigation',
            description: 'Stock transfers and adjustments',
            links: [
              { label: 'Material Transfers', path: '/inventory/transfers' },
              { label: 'Manual Stock Adjustments', path: '/inventory/adjust' }
            ]
          }
        ]
      },
      {
        title: 'Auditing & Closing',
        cards: [
          {
            title: 'Physical Auditing',
            icon: 'ClipboardCheck',
            description: 'Cycle counts, count sheets, and variance audits',
            links: [
              { label: 'Cycle Counts', path: '/inventory/cycle-counts' }
            ]
          },
          {
            title: 'Movement Ledger',
            icon: 'BookOpen',
            description: 'Unified movements ledger explorer',
            links: [
              { label: 'Movement Ledger', path: '/inventory/ledger' },
              { label: 'Closing Certificate', path: '/inventory/closing-certificate' }
            ]
          }
        ]
      },
      {
        title: 'Financial Inventory',
        cards: [
          {
            title: 'Costing & Snapshots',
            icon: 'Coins',
            description: 'Historical snapshots, valuations, and cost layers',
            links: [
              { label: 'Valuation Explorer', path: '/inventory/valuation' },
              { label: 'Revaluations Portal', path: '/inventory/revaluations' },
              { label: 'Snapshots Archive', path: '/inventory/snapshots' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'sales',
    title: 'Sales',
    icon: 'TrendingUp',
    roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'],
    categories: [
      {
        title: 'Operations',
        cards: [
          {
            title: 'Sales Orders',
            icon: 'FileText',
            description: 'Manage sales commitments and fulfillments',
            links: [
              { label: 'Sales Orders Registry', path: '/sales-orders' },
              { label: 'Create Sales Order', path: '/sales-orders/new' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing',
    icon: 'Cpu',
    roles: ['ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'],
    categories: [
      {
        title: 'Shop Floor & Execution',
        cards: [
          {
            title: 'Work Orders',
            icon: 'ClipboardList',
            description: 'Assemble and track shop floor orders',
            links: [
              { label: 'Work Orders Registry', path: '/manufacturing/work-orders' },
              { label: 'Active Shop Floor Control', path: '/manufacturing/shop-floor' }
            ]
          },
          {
            title: 'BOM & Routings',
            icon: 'Settings',
            description: 'Bill of Materials and sequence routings',
            links: [
              { label: 'BOM Manager', path: '/manufacturing/boms' },
              { label: 'Operation Routings', path: '/manufacturing/routings' },
              { label: 'Work Centers Database', path: '/manufacturing/work-centers' }
            ]
          }
        ]
      },
      {
        title: 'Advanced Planning (APS)',
        cards: [
          {
            title: 'Finite Scheduling',
            icon: 'Zap',
            description: 'Finite capacity scheduling and simulations',
            links: [
              { label: 'Capacity Horizons', path: '/manufacturing/capacity-planning' },
              { label: 'Production Scheduling Timeline', path: '/manufacturing/production-scheduling' },
              { label: 'Schedule Optimizer', path: '/manufacturing/optimizer' }
            ]
          },
          {
            title: 'Work Center Load',
            icon: 'Home',
            description: 'Utilization patterns and overload analysis',
            links: [
              { label: 'Work Center Load Heatmap', path: '/manufacturing/work-center-load' },
              { label: 'Bottleneck Exceptions', path: '/manufacturing/bottlenecks' }
            ]
          }
        ]
      },
      {
        title: 'Costing & Reporting',
        cards: [
          {
            title: 'Subledger & Variances',
            icon: 'DollarSign',
            description: 'Real-time WIP asset balances and yield variance reports',
            links: [
              { label: 'WIP Valuation Subledger', path: '/manufacturing/wip' },
              { label: 'Material & Labor Variances', path: '/manufacturing/variance' },
              { label: 'Recall Genealogy Reports', path: '/manufacturing/reports' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: 'Scale',
    roles: ['FINANCE_MANAGER', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'],
    categories: [
      {
        title: 'General Ledger',
        cards: [
          {
            title: 'Accounts & Ledgers',
            icon: 'FolderTree',
            description: 'Post manual journals, browse CoA and postings',
            links: [
              { label: 'Chart of Accounts', path: '/finance/coa' },
              { label: 'Manual Journal Workspace', path: '/finance/journals' },
              { label: 'G/L Postings Explorer', path: '/finance/ledger' }
            ]
          }
        ]
      },
      {
        title: 'Accounts Payable',
        cards: [
          {
            title: 'Vendor Invoices',
            icon: 'Receipt',
            description: 'Submit and approve vendor invoices',
            links: [
              { label: 'Invoices Dashboard', path: '/invoices' },
              { label: 'New Vendor Invoice', path: '/invoices/new' },
              { label: 'AP Liabilities Aging', path: '/finance/liabilities' }
            ]
          }
        ]
      },
      {
        title: 'Tally Integration',
        cards: [
          {
            title: 'Tally Sync Bridge',
            icon: 'RefreshCw',
            description: 'Chart of account mapping and sync queues',
            links: [
              { label: 'Tally ERP Sync Queue', path: '/finance/tally' },
              { label: 'Ledger Account Mapping', path: '/finance/tally/mapping' },
              { label: 'Reconciliation Console', path: '/finance/tally/reconciliation' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'quality',
    title: 'Quality',
    icon: 'CheckSquare',
    roles: ['ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER'],
    categories: [
      {
        title: 'Inspections',
        cards: [
          {
            title: 'Quality Control',
            icon: 'ShieldAlert',
            description: 'Log and monitor quality inspection steps',
            links: [
              { label: 'QC Console', path: '/grns' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: 'FileSpreadsheet',
    roles: ['EMPLOYEE', 'PROCUREMENT_MANAGER', 'FINANCE_MANAGER', 'WAREHOUSE_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    categories: [
      {
        title: 'Financial Statements',
        cards: [
          {
            title: 'Core Statements',
            icon: 'Scale',
            description: 'Trial balances, cash flows, and balance sheets',
            links: [
              { label: 'Balance Sheet', path: '/finance/balance-sheet' },
              { label: 'Profit & Loss Statement', path: '/finance/profit-loss' },
              { label: 'Cash Flow Statement', path: '/finance/cash-flow' }
            ]
          },
          {
            title: 'Governance Reconciliations',
            icon: 'Heart',
            description: 'Audit control accounts and reconciliations',
            links: [
              { label: 'Financial Governance', path: '/finance/health' },
              { label: 'AP Control Reconciliation', path: '/finance/ap-reconciliation' },
              { label: 'GRNI Control Reconciliation', path: '/finance/grni-reconciliation' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: 'Settings',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    categories: [
      {
        title: 'Governance Rules',
        cards: [
          {
            title: 'Workflow Setup',
            icon: 'Workflow',
            description: 'Define visual approval matrix rules',
            links: [
              { label: 'Approval Builder', path: '/workflows/builder' },
              { label: 'Guided Wizards Setup', path: '/wizards' }
            ]
          },
          {
            title: 'SLA Automation',
            icon: 'Timer',
            description: 'Configure SLAs and monitor breaches',
            links: [
              { label: 'SLA Rule Builder', path: '/sla/builder' },
              { label: 'Escalations Console', path: '/sla/escalations' }
            ]
          }
        ]
      },
      {
        title: 'Security & Operations',
        cards: [
          {
            title: 'Access Control',
            icon: 'Shield',
            description: 'Manage Role Based Access Control',
            links: [
              { label: 'RBAC Roles Matrix', path: '/rbac/matrix' },
              { label: 'API Integration Hub', path: '/integrations' }
            ]
          },
          {
            title: 'Data Migrations',
            icon: 'UploadCloud',
            description: 'Bulk CSV imports and audit logs',
            links: [
              { label: 'Data Migration Wizard', path: '/data-migration/wizard' },
              { label: 'Bulk Import History', path: '/data-migration/history' }
            ]
          }
        ]
      },
      {
        title: 'System Telemetry',
        cards: [
          {
            title: 'Telemetry & Logs',
            icon: 'Activity',
            description: 'CPU logs, celery queues, and exceptions',
            links: [
              { label: 'System Health Dashboard', path: '/observability/health' },
              { label: 'Queue Monitoring Console', path: '/observability/queues' },
              { label: 'Error Analytics Logging', path: '/observability/api-errors' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'crm',
    title: 'CRM',
    icon: 'Users',
    roles: [],
    disabled: true,
    categories: []
  },
  {
    id: 'hr',
    title: 'HR',
    icon: 'Award',
    roles: [],
    disabled: true,
    categories: []
  }
];

export interface RibbonButton {
  label: string;
  icon: string;
  actionType: 'navigate' | 'command';
  path?: string;
  commandName?: string;
  roles?: string[];
}

export interface RibbonGroup {
  title: string;
  buttons: RibbonButton[];
}

export const RIBBON_CONFIG: Record<string, RibbonGroup[]> = {
  purchase: [
    {
      title: 'Common Transactions',
      buttons: [
        { label: 'New PO', icon: 'FilePlus', actionType: 'navigate', path: '/pos/new' },
        { label: 'New PR', icon: 'FileText', actionType: 'navigate', path: '/requisitions/new' },
        { label: 'Approve Center', icon: 'CheckCircle', actionType: 'navigate', path: '/inbox' }
      ]
    },
    {
      title: 'Operations',
      buttons: [
        { label: 'Log GRN Dock', icon: 'Truck', actionType: 'navigate', path: '/receive-goods' },
        { label: 'Import CSV', icon: 'Upload', actionType: 'navigate', path: '/data-migration/wizard' }
      ]
    },
    {
      title: 'Reporting',
      buttons: [
        { label: 'Spend Analysis', icon: 'BarChart3', actionType: 'navigate', path: '/analytics' }
      ]
    }
  ],
  finance: [
    {
      title: 'Accounts Payable',
      buttons: [
        { label: 'New Invoice', icon: 'FilePlus', actionType: 'navigate', path: '/invoices/new' },
        { label: 'Accrued AP', icon: 'Landmark', actionType: 'navigate', path: '/finance/liabilities' }
      ]
    },
    {
      title: 'General Ledger',
      buttons: [
        { label: 'Chart of Accounts', icon: 'FolderTree', actionType: 'navigate', path: '/finance/coa' },
        { label: 'Manual Journal', icon: 'PenTool', actionType: 'navigate', path: '/finance/journals' },
        { label: 'Ledger Postings', icon: 'BookOpen', actionType: 'navigate', path: '/finance/ledger' }
      ]
    },
    {
      title: 'Sync',
      buttons: [
        { label: 'Tally Sync Queue', icon: 'RefreshCw', actionType: 'navigate', path: '/finance/tally' }
      ]
    }
  ],
  manufacturing: [
    {
      title: 'Shop Floor',
      buttons: [
        { label: 'New Work Order', icon: 'FilePlus', actionType: 'navigate', path: '/manufacturing/work-orders' },
        { label: 'Start Operations', icon: 'Play', actionType: 'navigate', path: '/manufacturing/shop-floor' }
      ]
    },
    {
      title: 'Advanced Planning (APS)',
      buttons: [
        { label: 'Capacity Planning', icon: 'Layers', actionType: 'navigate', path: '/manufacturing/capacity-planning' },
        { label: 'Production Scheduling', icon: 'Calendar', actionType: 'navigate', path: '/manufacturing/production-scheduling' },
        { label: 'Schedule Optimizer', icon: 'Zap', actionType: 'navigate', path: '/manufacturing/optimizer' }
      ]
    }
  ]
};

