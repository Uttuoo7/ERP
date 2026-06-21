export interface SettingsIndexItem {
  key: string;
  category: string; // 'General', 'Appearance', 'Navigation', etc.
  title: string;
  description: string;
  tabIndex: number; // The target tab index in SettingsCenter
  focusId: string; // Target DOM element input ID to focus
}

export class SettingsSearchEngine {
  private static INDEX: SettingsIndexItem[] = [
    { key: "landing", category: "General", title: "Landing Page", description: "Default module loaded after logging in", tabIndex: 0, focusId: "select-landing-page" },
    { key: "company", category: "General", title: "Default Company", description: "Preferred operational legal entity company settings", tabIndex: 0, focusId: "select-company" },
    { key: "warehouse", category: "General", title: "Default Warehouse", description: "Default warehouse for stock transactions", tabIndex: 0, focusId: "select-warehouse" },
    { key: "timezone", category: "General", title: "Time Zone", description: "Local timezone for logs, reports, and shifts", tabIndex: 0, focusId: "select-timezone" },
    { key: "language", category: "General", title: "Language", description: "App localized language translations settings", tabIndex: 0, focusId: "select-language" },
    { key: "currency", category: "General", title: "Preferred Currency", description: "Base billing or operational currency", tabIndex: 0, focusId: "select-currency" },
    
    { key: "theme", category: "Appearance", title: "Theme Manager", description: "Light, Dark, Enterprise Blue, Pro Gray, High Contrast themes", tabIndex: 1, focusId: "select-theme" },
    { key: "density", category: "Appearance", title: "Table Density", description: "Adjust compact or comfortable row heights in grids", tabIndex: 1, focusId: "btn-toggle-density" },
    
    { key: "favorites", category: "Navigation", title: "Favorites Configuration", description: "Pin, unpin or reorder favorite modules", tabIndex: 2, focusId: "favorites-editor" },
    
    { key: "channels", category: "Notifications", title: "Notification Channels", description: "Routing preferences: Email, Desktop, push, sound, SMS, Slack, Teams", tabIndex: 4, focusId: "routing-toggles" },
    
    { key: "shortcuts", category: "Keyboard", title: "Keyboard Shortcuts", description: "Customize application hotkeys and actions", tabIndex: 5, focusId: "keyboard-shortcuts-grid" },
    { key: "accessibility", category: "Accessibility", title: "Accessibility Controls", description: "ARIA tags configuration, screen reader compatibility mode, reduced motion animations", tabIndex: 6, focusId: "screen-reader-toggle" }
  ];

  public static search(query: string): SettingsIndexItem[] {
    const term = query.toLowerCase().trim();
    if (!term) return [];
    
    return this.INDEX.filter(item => 
      item.title.toLowerCase().includes(term) || 
      item.description.toLowerCase().includes(term) || 
      item.category.toLowerCase().includes(term)
    );
  }
}
