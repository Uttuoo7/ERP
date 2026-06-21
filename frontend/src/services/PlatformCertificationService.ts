import type { PluginManifest } from '../sdk/EnterprisePlatformSDK';

export class PlatformCertificationService {
  public static certify(manifest: PluginManifest): { certified: boolean; errors: string[] } {
    const errors: string[] = [];

    // Security Checks
    const manifestStr = JSON.stringify(manifest).toLowerCase();
    if (manifestStr.includes("bypassauth") || manifestStr.includes("bypass_auth")) {
      errors.push("[Security] Module contains hooks attempting to bypass authentication rules.");
    }
    if (manifestStr.includes("unsafe-eval") || manifestStr.includes("eval(")) {
      errors.push("[Security] Module utilizes eval or other code-injection structures.");
    }

    // Accessibility Checks
    if (manifest.routes) {
      manifest.routes.forEach(route => {
        if (!route.title) {
          errors.push(`[Accessibility] Route '${route.path}' is missing an aria screen-reader title.`);
        }
      });
    }

    // Performance Checks
    if (manifest.widgets && manifest.widgets.length > 5) {
      errors.push("[Performance] Module registers more than 5 widgets on home workspace, violating rendering budgets.");
    }

    return {
      certified: errors.length === 0,
      errors
    };
  }
}
