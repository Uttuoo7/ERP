# Plugin Development Guide

This guide walks through creating new modules for the ERP platform utilizing the code-driven plugin framework.

## Getting Started

Every new plugin must register itself with the `EnterprisePlatformSDK` and expose a typed manifest.

### Example: HR Extension Plugin

Create `frontend/src/plugins/hr/index.ts`:

```typescript
import { PluginManifest } from '../../sdk/EnterprisePlatformSDK';

export const HRExtension: PluginManifest = {
  key: "hr_module",
  version: "1.0.0",
  dependencies: [],
  compatibility: {
    minimumPlatformVersion: "1.0.0",
    minimumDatabaseSchema: "1.0",
    supportedApiVersion: "v1"
  },
  routes: [
    { path: "/hr/attendance", title: "Employee Attendance", componentName: "HRAttendance", roles: ["ADMIN"] }
  ],
  megaMenu: [
    {
      moduleId: "hr",
      cardTitle: "Attendance Tracker",
      cardIcon: "Clock",
      cardDescription: "Track check-in times and leaves",
      links: [
        { label: "Attendance Sheet", path: "/hr/attendance" }
      ]
    }
  ]
};
```

Register the extension inside `PluginRegistry.ts`:

```typescript
import { HRExtension } from '../plugins/hr';
EnterprisePlatformSDK.registerPlugin(HRExtension);
```

## Backend Hooks

You can define database migrations and seeds inside the plugin hooks:
- `onInstall(db)`: Run migrations, seed static roles.
- `onUpgrade(db)`: Perform schema adjustments safely.
- `onUninstall(db)`: Rollback custom data structures.
