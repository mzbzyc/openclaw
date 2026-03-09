import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("model-health");

interface ModelHealthStatus {
  provider: string;
  model: string;
  healthy: boolean;
  latency: number;
  lastChecked: number;
}

interface HealthCheckOptions {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export class ModelHealthChecker {
  private healthStatuses: Map<string, ModelHealthStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * 开始定期健康检查
   */
  public startPeriodicChecks(intervalMs: number = 30000) {
    this.stopPeriodicChecks();
    this.checkInterval = setInterval(() => {
      this.checkAllModels();
    }, intervalMs);
  }

  /**
   * 停止定期健康检查
   */
  public stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 检查所有已知模型的健康状态
   */
  private async checkAllModels() {
    const models = Array.from(this.healthStatuses.keys());
    for (const modelKey of models) {
      const [provider, model] = modelKey.split("/");
      if (provider && model) {
        await this.checkModelHealth(provider, model);
      }
    }
  }

  /**
   * 检查模型健康状态
   */
  public async checkModelHealth(provider: string, model: string, options: HealthCheckOptions = {}): Promise<ModelHealthStatus> {
    const { timeoutMs = 5000, retryCount = 2, retryDelayMs = 1000 } = options;
    const modelKey = `${provider}/${model}`;

    let healthy = false;
    let latency = 0;

    for (let i = 0; i <= retryCount; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }

      try {
        const startTime = Date.now();
        healthy = await this.performHealthCheck(provider, model, timeoutMs);
        latency = Date.now() - startTime;

        if (healthy) {
          break;
        }
      } catch (error) {
        log.warn(`Health check failed for ${modelKey}: ${error}`);
      }
    }

    const status: ModelHealthStatus = {
      provider,
      model,
      healthy,
      latency,
      lastChecked: Date.now()
    };

    this.healthStatuses.set(modelKey, status);
    return status;
  }

  /**
   * 执行具体的健康检查
   */
  private async performHealthCheck(provider: string, model: string, timeoutMs: number): Promise<boolean> {
    switch (provider) {
      case "ollama":
        return this.checkOllamaHealth(model, timeoutMs);
      case "lmstudio":
        return this.checkLMStudioHealth(model, timeoutMs);
      default:
        // 对于云端模型，假设健康
        return true;
    }
  }

  /**
   * 检查 Ollama 模型健康状态
   */
  private async checkOllamaHealth(model: string, timeoutMs: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const models = data.models || [];
      return models.some((m: any) => m.name === model);
    } catch {
      return false;
    }
  }

  /**
   * 检查 LM Studio 模型健康状态
   */
  private async checkLMStudioHealth(model: string, timeoutMs: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch("http://127.0.0.1:1234/v1/models", {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const models = data.data || [];
      return models.some((m: any) => m.id === model);
    } catch {
      return false;
    }
  }

  /**
   * 获取模型健康状态
   */
  public getModelHealth(provider: string, model: string): ModelHealthStatus | null {
    const modelKey = `${provider}/${model}`;
    return this.healthStatuses.get(modelKey) || null;
  }

  /**
   * 检查模型是否健康
   */
  public isModelHealthy(provider: string, model: string): boolean {
    const status = this.getModelHealth(provider, model);
    if (!status) {
      return false;
    }

    // 检查是否在有效期内（5分钟）
    const validThreshold = Date.now() - 5 * 60 * 1000;
    if (status.lastChecked < validThreshold) {
      return false;
    }

    return status.healthy;
  }

  /**
   * 清除模型健康状态
   */
  public clearModelHealth(provider: string, model: string) {
    const modelKey = `${provider}/${model}`;
    this.healthStatuses.delete(modelKey);
  }

  /**
   * 清除所有健康状态
   */
  public clearAllHealthStatuses() {
    this.healthStatuses.clear();
  }

  /**
   * 获取所有模型的健康状态
   */
  public getAllHealthStatuses(): ModelHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }
}

// 导出单例实例
export const modelHealthChecker = new ModelHealthChecker();
