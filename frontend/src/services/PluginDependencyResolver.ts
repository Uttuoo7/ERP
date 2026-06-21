import { PluginManifest } from '../sdk/EnterprisePlatformSDK';

export class PluginDependencyResolver {
  public static resolveStartupOrder(
    plugins: PluginManifest[],
    enabledKeys: Set<string>
  ): { order: PluginManifest[]; warnings: string[] } {
    const order: PluginManifest[] = [];
    const warnings: string[] = [];
    
    const visited: Map<string, 'VISITING' | 'VISITED'> = new Map();
    const pluginMap = new Map<string, PluginManifest>();
    
    // Map of only currently enabled plugin manifests
    plugins.forEach(p => {
      if (enabledKeys.has(p.key)) {
        pluginMap.set(p.key, p);
      }
    });

    const visit = (key: string) => {
      const state = visited.get(key);
      if (state === 'VISITING') {
        warnings.append(`Circular dependency detected involving plugin: ${key}`);
        throw new Error(`Circular dependency detected: ${key}`);
      }
      if (state === 'VISITED') return;

      const p = pluginMap.get(key);
      if (!p) {
        warnings.append(`Missing dependency: ${key}`);
        return;
      }

      visited.set(key, 'VISITING');
      
      const deps = p.dependencies || [];
      for (const dep of deps) {
        visit(dep);
      }

      visited.set(key, 'VISITED');
      order.push(p);
    };

    // Polyfill Array append warning in standard JS mapping
    const warningsWrapper = {
      append: (str: string) => {
        if (!warnings.includes(str)) {
          warnings.push(str);
        }
      }
    };

    // Override local visit array variables wrapper
    const visitSafe = (key: string) => {
      try {
        visit(key);
      } catch (e: any) {
        console.warn(e.message);
      }
    };

    for (const key of pluginMap.keys()) {
      if (!visited.has(key)) {
        visitSafe(key);
      }
    }

    return { order, warnings };
  }
}
