# SDK Reference & Extension API Reference

## EnterprisePlatformSDK

### Methods

#### `registerPlugin(manifest: PluginManifest): void`
Registers a strongly typed plugin manifest into the runtime.

#### `getPlugin(key: string): PluginManifest | undefined`
Retrieves a registered plugin by key.

#### `getPlugins(): PluginManifest[]`
Returns list of all registered plugin manifests.

---

## Extension Contracts

### `NavigationContract`
Contract version: `1.0.0`
- `renderIcon(name: string): JSX.Element`
- `validateRoles(userRoles: string[], requiredRoles: string[]): boolean`

### `RibbonContract`
Contract version: `1.0.0`
- `triggerAction(actionKey: string, context: any): void`

### `DashboardContract`
Contract version: `1.0.0`
- `renderWidget(widgetId: string, parameters: any): JSX.Element`
