export interface RouteExtension {
  path: string;
  title: string;
  componentName: string; // The registered component key
  roles: string[];
}

export interface NavigationExtension {
  id: string;
  title: string;
  path: string;
  roles: string[];
  icon: string;
}

export interface MegaMenuExtension {
  moduleId: string;
  cardTitle: string;
  cardIcon: string;
  cardDescription: string;
  links: Array<{ label: string; path: string; roles?: string[]; shortcut?: string }>;
}

export interface RibbonExtension {
  moduleId: string;
  groupLabel: string;
  buttons: Array<{ label: string; actionKey: string; icon: string; roles?: string[] }>;
}

export interface DashboardExtension {
  widgetId: string;
  title: string;
  componentName: string;
  roles: string[];
}

export interface ReportExtension {
  id: string;
  title: string;
  category: string;
  roles: string[];
}

export interface SearchExtension {
  providerKey: string;
  title: string;
  roles: string[];
}

export interface CommandPaletteExtension {
  trigger: string;
  actionKey: string;
  description: string;
}

export interface NotificationExtension {
  channelKey: string;
  title: string;
}

export interface SettingsPageExtension {
  tabKey: string;
  title: string;
  componentName: string;
}

export interface PluginManifest {
  key: string;
  version: string;
  routes?: RouteExtension[];
  navigation?: NavigationExtension[];
  megaMenu?: MegaMenuExtension[];
  ribbon?: RibbonExtension[];
  widgets?: DashboardExtension[];
  reports?: ReportExtension[];
  searchProviders?: SearchExtension[];
  commands?: CommandPaletteExtension[];
  notificationProviders?: NotificationExtension[];
  settingsPages?: SettingsPageExtension[];
  dependencies?: string[];
  compatibility?: {
    minimumPlatformVersion: string;
    maximumPlatformVersion?: string;
    minimumDatabaseSchema: string;
    supportedApiVersion: string;
  };
}

export class EnterprisePlatformSDK {
  private static registeredPlugins: Map<string, PluginManifest> = new Map();

  public static registerPlugin(manifest: PluginManifest): void {
    this.registeredPlugins.set(manifest.key, manifest);
    console.log(`[SDK] Plugin registered successfully: ${manifest.key} v${manifest.version}`);
  }

  public static getPlugin(key: string): PluginManifest | undefined {
    return this.registeredPlugins.get(key);
  }

  public static getPlugins(): PluginManifest[] {
    return Array.from(this.registeredPlugins.values());
  }
}
