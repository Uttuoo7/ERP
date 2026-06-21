import type { PluginManifest } from '../sdk/EnterprisePlatformSDK';

export class PlatformCompatibilityValidator {
  private static PLATFORM_VERSION = "1.0.0";
  private static DATABASE_SCHEMA = "1.0";
  private static API_VERSION = "v1";

  private static parseSemver(version: string): number[] {
    try {
      return version.split('.').map(x => parseInt(x, 10));
    } catch {
      return [0, 0, 0];
    }
  }

  private static compareSemver(v1: string, v2: string): number {
    const p1 = this.parseSemver(v1);
    const p2 = this.parseSemver(v2);
    for (let i = 0; i < 3; i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  public static validate(manifest: PluginManifest): { isValid: boolean; warning?: string } {
    const compat = manifest.compatibility;
    if (!compat) {
      return { isValid: false, warning: "Missing compatibility specifications manifest." };
    }

    // Platform Minimum check
    if (this.compareSemver(this.PLATFORM_VERSION, compat.minimumPlatformVersion) < 0) {
      return {
        isValid: false,
        warning: `Plugin requires platform version >= ${compat.minimumPlatformVersion}. Current platform is ${this.PLATFORM_VERSION}.`
      };
    }

    // Platform Maximum check
    if (compat.maximumPlatformVersion && this.compareSemver(this.PLATFORM_VERSION, compat.maximumPlatformVersion) > 0) {
      return {
        isValid: false,
        warning: `Plugin requires platform version <= ${compat.maximumPlatformVersion}. Current platform is ${this.PLATFORM_VERSION}.`
      };
    }

    // DB Schema check
    if (parseFloat(this.DATABASE_SCHEMA) < parseFloat(compat.minimumDatabaseSchema)) {
      return {
        isValid: false,
        warning: `Plugin requires database schema version >= ${compat.minimumDatabaseSchema}. Current schema is ${this.DATABASE_SCHEMA}.`
      };
    }

    // API version check
    if (this.API_VERSION !== compat.supportedApiVersion) {
      return {
        isValid: false,
        warning: `Plugin requires API version ${compat.supportedApiVersion}. Current API is ${this.API_VERSION}.`
      };
    }

    return { isValid: true };
  }
}
