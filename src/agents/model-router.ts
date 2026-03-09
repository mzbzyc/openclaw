import type { OpenClawConfig } from "../config/config.js";
import { DEFAULT_MODEL_TIERS } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { sanitizeForLog } from "../terminal/ansi.js";
import { normalizeModelRef, parseModelRef, modelKey } from "./model-selection.js";
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from "./defaults.js";

const log = createSubsystemLogger("model-router");

interface ModelRouterOptions {
  cfg: OpenClawConfig;
  agentDir?: string;
}

interface ModelTierInfo {
  tier: string;
  provider: string;
  model: string;
  maxConcurrency: number;
  timeoutMs: number;
}

interface ModelConcurrencyInfo {
  [key: string]: number;
}

export class ModelRouter {
  private cfg: OpenClawConfig;
  private agentDir?: string;
  private concurrencyInfo: ModelConcurrencyInfo = {};
  private healthCheckResults: Map<string, boolean> = new Map();

  constructor(options: ModelRouterOptions) {
    this.cfg = options.cfg;
    this.agentDir = options.agentDir;
  }

  /**
   * Select appropriate model tier based on task type
   */
  public selectTier(taskType: string): string {
    // Select tier based on task type
    switch (taskType) {
      case "file_operation":
      case "system_command":
      case "quick_query":
        return "tier_fast";
      case "code_generation":
      case "content_creation":
        return "tier_balanced";
      case "deep_analysis":
      case "complex_reasoning":
        return "tier_smart";
      default:
        return "tier_fast";
    }
  }

  /**
   * Get model tier configuration
   */
  public getTierConfig(tier: string) {
    const tiers = this.cfg.models?.tiers || DEFAULT_MODEL_TIERS;
    return (tiers as Record<string, any>)[tier] || (DEFAULT_MODEL_TIERS as Record<string, any>)[tier];
  }

  /**
   * Select model considering health status and concurrency limits
   */
  public async selectModel(tier: string): Promise<ModelTierInfo> {
    const tierConfig = this.getTierConfig(tier);
    if (!tierConfig) {
      throw new Error(`Tier ${tier} not found`);
    }

    // Build candidate model list
    const candidates = [tierConfig.primary, ...(tierConfig.fallbacks || [])];

    // Select model by priority
    for (const candidate of candidates) {
      const parsed = parseModelRef(candidate, DEFAULT_PROVIDER);
      if (!parsed) continue;

      const modelKeyStr = modelKey(parsed.provider, parsed.model);
      
      // Check model health status
      if (!await this.isModelHealthy(parsed.provider, parsed.model)) {
        log.warn(`Model ${modelKeyStr} is unhealthy, skipping`);
        continue;
      }

      // Check concurrency limit
      if (!this.checkConcurrency(modelKeyStr, tierConfig.maxConcurrency || 1)) {
        log.warn(`Model ${modelKeyStr} has reached concurrency limit, skipping`);
        continue;
      }

      // Increase concurrency count
      this.incrementConcurrency(modelKeyStr);

      return {
        tier,
        provider: parsed.provider,
        model: parsed.model,
        maxConcurrency: tierConfig.maxConcurrency || 1,
        timeoutMs: tierConfig.timeoutMs || 5000
      };
    }

    // Fallback to cloud model
    log.info(`No healthy models available for tier ${tier}, falling back to cloud model`);
    const cloudModel = this.getCloudFallbackModel(tier);
    const cloudModelKey = modelKey(cloudModel.provider, cloudModel.model);
    this.incrementConcurrency(cloudModelKey);

    return {
      tier,
      provider: cloudModel.provider,
      model: cloudModel.model,
      maxConcurrency: 10, // Higher concurrency limit for cloud models
      timeoutMs: 10000 // Longer timeout for cloud models
    };
  }

  /**
   * Get cloud fallback model
   */
  private getCloudFallbackModel(tier: string) {
    switch (tier) {
      case "tier_fast":
        return { provider: "aliyun", model: "qwen-turbo" };
      case "tier_balanced":
        return { provider: "deepseek", model: "deepseek-code" };
      case "tier_smart":
        return { provider: "anthropic", model: "claude-sonnet-4-5" };
      default:
        return { provider: "aliyun", model: "qwen-turbo" };
    }
  }

  /**
   * Release model concurrency count
   */
  public releaseConcurrency(provider: string, model: string) {
    const key = modelKey(provider, model);
    if (this.concurrencyInfo[key]) {
      this.concurrencyInfo[key]--;
      if (this.concurrencyInfo[key] < 0) {
        this.concurrencyInfo[key] = 0;
      }
    }
  }

  /**
   * Check model health status
   */
  private async isModelHealthy(provider: string, model: string): Promise<boolean> {
    const key = modelKey(provider, model);
    
    // For local models, perform health check
    if (provider === "ollama") {
      return await this.checkOllamaHealth(model);
    }
    
    // For cloud models, assume healthy
    return true;
  }

  /**
   * Check Ollama model health status
   */
  private async checkOllamaHealth(model: string): Promise<boolean> {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/tags");
      if (!response.ok) return false;
      
      const data = await response.json();
      const models = data.models || [];
      return models.some((m: any) => m.name === model);
    } catch {
      return false;
    }
  }

  /**
   * Check concurrency limit
   */
  private checkConcurrency(modelKey: string, maxConcurrency: number): boolean {
    const current = this.concurrencyInfo[modelKey] || 0;
    return current < maxConcurrency;
  }

  /**
   * Increase concurrency count
   */
  private incrementConcurrency(modelKey: string) {
    if (!this.concurrencyInfo[modelKey]) {
      this.concurrencyInfo[modelKey] = 0;
    }
    this.concurrencyInfo[modelKey]++;
  }

  /**
   * Get current concurrency status
   */
  public getConcurrencyStatus() {
    return this.concurrencyInfo;
  }

  /**
   * Reset concurrency status
   */
  public resetConcurrency() {
    this.concurrencyInfo = {};
  }

  /**
   * Get execution mode indicator
   */
  public getExecutionMode(tier: string, provider: string): string {
    if (tier === "tier_fast" && (provider === "ollama" || provider === "lm-studio")) {
      return "⚡ [Local Fast]";
    } else if (tier === "tier_smart" && (provider !== "ollama" && provider !== "lm-studio")) {
      return "🧠 [Deep Thinking]";
    } else if (provider !== "ollama" && provider !== "lm-studio") {
      return "☁️ [Cloud Fallback]";
    }
    return "";
  }
}
