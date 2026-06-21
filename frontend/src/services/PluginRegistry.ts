import { EnterprisePlatformSDK } from '../sdk/EnterprisePlatformSDK';
import type { PluginManifest } from '../sdk/EnterprisePlatformSDK';

// Seed declarations for future business modules
export const ProcurementPlugin: PluginManifest = {
  key: "procurement",
  version: "1.0.0",
  dependencies: [],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  },
  routes: [
    { path: "/pos/new", title: "New PO Creation", componentName: "PurchaseOrderForm", roles: ["BUYER", "ADMIN"] },
    { path: "/pos", title: "PO Registry View", componentName: "POList", roles: ["BUYER", "ADMIN"] }
  ],
  megaMenu: [
    {
      moduleId: "purchase",
      cardTitle: "Direct Procurement",
      cardIcon: "FileText",
      cardDescription: "Purchase Orders and Inbound Shipments",
      links: [
        { label: "Purchase Orders Feed", path: "/pos" },
        { label: "New PO Builder", path: "/pos/new", shortcut: "Ctrl+Shift+P" }
      ]
    }
  ],
  ribbon: [
    {
      moduleId: "purchase",
      groupLabel: "Quick Actions",
      buttons: [
        { label: "New PO", actionKey: "new_po", icon: "Plus", roles: ["BUYER"] },
        { label: "Approve Batch", actionKey: "bulk_approve", icon: "Check", roles: ["PROCUREMENT_MANAGER"] }
      ]
    }
  ],
  widgets: [
    { widgetId: "po_pipeline", title: "PO Approval Pipeline", componentName: "PipelineWidget", roles: ["ADMIN"] }
  ]
};

export const InventoryPlugin: PluginManifest = {
  key: "inventory",
  version: "1.0.0",
  dependencies: ["procurement"],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  },
  routes: [
    { path: "/inventory", title: "Warehouse Control Panel", componentName: "WarehouseDashboard", roles: ["WAREHOUSE_MANAGER", "ADMIN"] }
  ],
  megaMenu: [
    {
      moduleId: "inventory",
      cardTitle: "Warehouse Operations",
      cardIcon: "Boxes",
      cardDescription: "Stock counts, revaluations, and snapshots",
      links: [
        { label: "Warehouse Live Dashboard", path: "/inventory" }
      ]
    }
  ]
};

export const FinancePlugin: PluginManifest = {
  key: "finance",
  version: "1.0.0",
  dependencies: [],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  },
  routes: [
    { path: "/finance/dashboard", title: "Finance KPI Dashboard", componentName: "APLiabilityDashboard", roles: ["FINANCE_MANAGER", "ADMIN"] }
  ]
};

export const ManufacturingPlugin: PluginManifest = {
  key: "manufacturing",
  version: "1.0.0",
  dependencies: ["inventory"],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  },
  routes: [
    { path: "/manufacturing/work-orders", title: "Work Orders Control Room", componentName: "WorkOrdersList", roles: ["ADMIN"] }
  ]
};

export const CRMPlugin: PluginManifest = {
  key: "crm",
  version: "1.0.0",
  dependencies: [],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export const HRPlugin: PluginManifest = {
  key: "hr",
  version: "1.0.0",
  dependencies: [],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export const PlanningPlugin: PluginManifest = {
  key: "planning",
  version: "1.0.0",
  dependencies: ["manufacturing"],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export const QualityPlugin: PluginManifest = {
  key: "quality",
  version: "1.0.0",
  dependencies: ["manufacturing"],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export const SupplierPortalPlugin: PluginManifest = {
  key: "supplier_portal",
  version: "1.0.0",
  dependencies: ["procurement"],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export const CustomerPortalPlugin: PluginManifest = {
  key: "customer_portal",
  version: "1.0.0",
  dependencies: ["crm"],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export const AIAssistantPlugin: PluginManifest = {
  key: "ai_assistant",
  version: "1.0.0",
  dependencies: [],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export const AnalyticsPlugin: PluginManifest = {
  key: "analytics",
  version: "1.0.0",
  dependencies: ["finance"],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  }
};

export class PluginRegistry {
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) return;
    
    // Register all default platform plugins
    EnterprisePlatformSDK.registerPlugin(ProcurementPlugin);
    EnterprisePlatformSDK.registerPlugin(InventoryPlugin);
    EnterprisePlatformSDK.registerPlugin(FinancePlugin);
    EnterprisePlatformSDK.registerPlugin(ManufacturingPlugin);
    EnterprisePlatformSDK.registerPlugin(CRMPlugin);
    EnterprisePlatformSDK.registerPlugin(HRPlugin);
    EnterprisePlatformSDK.registerPlugin(PlanningPlugin);
    EnterprisePlatformSDK.registerPlugin(QualityPlugin);
    EnterprisePlatformSDK.registerPlugin(SupplierPortalPlugin);
    EnterprisePlatformSDK.registerPlugin(CustomerPortalPlugin);
    EnterprisePlatformSDK.registerPlugin(AIAssistantPlugin);
    EnterprisePlatformSDK.registerPlugin(AnalyticsPlugin);

    this.isInitialized = true;
    console.log("[PluginRegistry] Registered all core and extension modules successfully.");
  }
}
