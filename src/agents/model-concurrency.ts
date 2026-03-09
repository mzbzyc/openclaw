import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("model-concurrency");

interface ConcurrencyInfo {
  [modelKey: string]: {
    current: number;
    max: number;
    lastUpdated: number;
  };
}

interface ModelConcurrencyOptions {
  defaultMaxConcurrency?: number;
  checkIntervalMs?: number;
}

export class ModelConcurrencyManager {
  private concurrencyInfo: ConcurrencyInfo = {};
  private checkInterval: NodeJS.Timeout | null = null;
  private defaultMaxConcurrency: number;

  constructor(options: ModelConcurrencyOptions = {}) {
    this.defaultMaxConcurrency = options.defaultMaxConcurrency || 2;
    
    // Start periodic checks
    if (options.checkIntervalMs) {
      this.startPeriodicChecks(options.checkIntervalMs);
    }
  }

  /**
   * Start periodic checks
   */
  public startPeriodicChecks(intervalMs: number = 5000) {
    this.stopPeriodicChecks();
    this.checkInterval = setInterval(() => {
      this.checkConcurrencyLevels();
    }, intervalMs);
  }

  /**
   * Stop periodic checks
   */
  public stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check concurrency levels
   */
  private checkConcurrencyLevels() {
    const now = Date.now();
    
    for (const [modelKey, info] of Object.entries(this.concurrencyInfo)) {
      // Clean up stale entries (older than 5 minutes)
      if (now - info.lastUpdated > 5 * 60 * 1000) {
        delete this.concurrencyInfo[modelKey];
        log.info(`Cleared stale concurrency info for ${modelKey}`);
      }
    }
  }

  /**
   * Check if model can handle new request
   */
  public canHandleRequest(provider: string, model: string, maxConcurrency?: number): boolean {
    const modelKey = `${provider}/${model}`;
    const info = this.concurrencyInfo[modelKey];
    const max = maxConcurrency || this.defaultMaxConcurrency;
    
    if (!info) {
      return true;
    }
    
    return info.current < max;
  }

  /**
   * Increase model concurrency count
   */
  public incrementConcurrency(provider: string, model: string, maxConcurrency?: number) {
    const modelKey = `${provider}/${model}`;
    const max = maxConcurrency || this.defaultMaxConcurrency;
    
    if (!this.concurrencyInfo[modelKey]) {
      this.concurrencyInfo[modelKey] = {
        current: 0,
        max,
        lastUpdated: Date.now()
      };
    }
    
    this.concurrencyInfo[modelKey].current++;
    this.concurrencyInfo[modelKey].max = max;
    this.concurrencyInfo[modelKey].lastUpdated = Date.now();
    
    log.debug(`Incremented concurrency for ${modelKey}: ${this.concurrencyInfo[modelKey].current}/${this.concurrencyInfo[modelKey].max}`);
  }

  /**
   * Decrease model concurrency count
   */
  public decrementConcurrency(provider: string, model: string) {
    const modelKey = `${provider}/${model}`;
    
    if (this.concurrencyInfo[modelKey]) {
      this.concurrencyInfo[modelKey].current--;
      this.concurrencyInfo[modelKey].lastUpdated = Date.now();
      
      if (this.concurrencyInfo[modelKey].current < 0) {
        this.concurrencyInfo[modelKey].current = 0;
      }
      
      log.debug(`Decremented concurrency for ${modelKey}: ${this.concurrencyInfo[modelKey].current}/${this.concurrencyInfo[modelKey].max}`);
    }
  }

  /**
   * Get model concurrency status
   */
  public getConcurrencyStatus(provider: string, model: string) {
    const modelKey = `${provider}/${model}`;
    return this.concurrencyInfo[modelKey] || {
      current: 0,
      max: this.defaultMaxConcurrency,
      lastUpdated: Date.now()
    };
  }

  /**
   * Get all models concurrency status
   */
  public getAllConcurrencyStatus() {
    return this.concurrencyInfo;
  }

  /**
   * Reset concurrency status
   */
  public resetConcurrency() {
    this.concurrencyInfo = {};
    log.info("Reset all concurrency info");
  }

  /**
   * Check if overflow to cloud is needed
   */
  public shouldOverflowToCloud(provider: string, model: string, maxConcurrency?: number): boolean {
    // Only local models need overflow
    if (provider !== "ollama" && provider !== "lm-studio" && provider !== "lmstudio") {
      return false;
    }
    
    return !this.canHandleRequest(provider, model, maxConcurrency);
  }

  /**
   * Get overflow suggestion
   */
  public getOverflowSuggestion(provider: string, model: string, tier: string) {
    if (!this.shouldOverflowToCloud(provider, model)) {
      return null;
    }
    
    // Return appropriate cloud model based on current tier
    switch (tier) {
      case "tier_fast":
        return {
          provider: "aliyun",
          model: "qwen-turbo"
        };
      case "tier_balanced":
        return {
          provider: "deepseek",
          model: "deepseek-code"
        };
      case "tier_smart":
        return {
          provider: "anthropic",
          model: "claude-sonnet-4-5"
        };
      default:
        return {
          provider: "aliyun",
          model: "qwen-turbo"
        };
    }
  }
}

// Export singleton instance
export const modelConcurrencyManager = new ModelConcurrencyManager({ defaultMaxConcurrency: 2 });
