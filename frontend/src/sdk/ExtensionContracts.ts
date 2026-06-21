export interface NavigationContract {
  version: string;
  renderIcon(name: string): any;
  validateRoles(userRoles: string[], requiredRoles: string[]): boolean;
}

export interface RibbonContract {
  version: string;
  triggerAction(actionKey: string, context: any): void;
}

export interface DashboardContract {
  version: string;
  renderWidget(widgetId: string, parameters: any): any;
}

export interface WorkflowContract {
  version: string;
  checkTransition(fromState: string, toState: string, payload: any): boolean;
}

export interface NotificationContract {
  version: string;
  send(channel: string, message: any): Promise<boolean>;
}

export interface SearchContract {
  version: string;
  query(searchTerm: string): Promise<any[]>;
}

export interface AIContract {
  version: string;
  recommend(inputData: any): Promise<any>;
}

export const ExtensionContracts = {
  navigation: "1.0.0",
  ribbon: "1.0.0",
  dashboard: "1.0.0",
  workflow: "1.0.0",
  notification: "1.0.0",
  search: "1.0.0",
  ai: "1.0.0"
};
