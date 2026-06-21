export interface TelemetryEvent {
  metric: string;
  value: number; // in ms, percentage, or counts
  timestamp: number;
}

export class EnterpriseTelemetryService {
  private static events: TelemetryEvent[] = [];
  private static cacheHits = 0;
  private static cacheMisses = 0;
  private static wsReconnects = 0;
  private static isDevHUDEnabled = true;

  public static logMetric(metric: string, value: number): void {
    this.events.push({ metric, value, timestamp: Date.now() });
    if (this.events.length > 500) {
      this.events.shift(); // keep capacity bounded
    }
  }

  public static recordCacheHit(): void {
    this.cacheHits++;
  }

  public static recordCacheMiss(): void {
    this.cacheMisses++;
  }

  public static recordWsReconnect(): void {
    this.wsReconnects++;
  }

  public static getCacheHitRatio(): number {
    const total = this.cacheHits + this.cacheMisses;
    if (total === 0) return 1.0;
    return this.cacheHits / total;
  }

  public static getWsReconnectCount(): number {
    return this.wsReconnects;
  }

  public static getEvents(): TelemetryEvent[] {
    return this.events;
  }

  public static isHUDAvailable(): boolean {
    // Only available in dev mode by default, unless overridden by admin
    return this.isDevHUDEnabled;
  }

  public static toggleHUD(enabled: boolean): void {
    this.isDevHUDEnabled = enabled;
  }
}
