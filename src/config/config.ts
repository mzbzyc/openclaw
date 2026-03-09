export {
  clearConfigCache,
  ConfigRuntimeRefreshError,
  clearRuntimeConfigSnapshot,
  createConfigIO,
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
  loadConfig,
  readBestEffortConfig,
  parseConfigJson5,
  readConfigFileSnapshot,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
  setRuntimeConfigSnapshotRefreshHandler,
  setRuntimeConfigSnapshot,
  writeConfigFile,
} from "./io.js";
export { migrateLegacyConfig } from "./legacy-migrate.js";
export * from "./paths.js";
export * from "./runtime-overrides.js";
export * from "./types.js";

// 模型梯队相关配置
export const DEFAULT_MODEL_TIERS = {
  tier_fast: {
    primary: "ollama/qwen2.5:3b",
    fallbacks: ["aliyun/qwen-turbo", "deepseek/deepseek-chat"],
    maxConcurrency: 2,
    timeoutMs: 5000
  },
  tier_balanced: {
    primary: "ollama/qwen2.5-coder",
    fallbacks: ["aliyun/qwen-plus", "deepseek/deepseek-code"],
    maxConcurrency: 1,
    timeoutMs: 10000
  },
  tier_smart: {
    primary: "anthropic/claude-sonnet-4-5",
    fallbacks: ["openai/gpt-5.2", "anthropic/claude-opus-4-5"],
    maxConcurrency: 1,
    timeoutMs: 15000
  }
};

export {
  validateConfigObject,
  validateConfigObjectRaw,
  validateConfigObjectRawWithPlugins,
  validateConfigObjectWithPlugins,
} from "./validation.js";
