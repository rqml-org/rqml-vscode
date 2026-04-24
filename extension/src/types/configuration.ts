// REQ-CFG-004: Configuration types for RQML extension
// REQ-CFG-005: VS Code theme integration (no custom palettes)

/**
 * REQ-CFG-004: Supported LLM provider identifiers.
 *
 * Providers are singletons — at most one key and one active configuration
 * per provider. Provider catalog entries live in src/models/catalog.ts.
 */
export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure-openai'
  | 'xai'
  | 'mistral'
  | 'groq'
  | 'deepseek'
  | 'perplexity';

/**
 * REQ-AGT-013: Strictness levels for agent behaviour
 */
export type StrictnessLevel = 'relaxed' | 'standard' | 'strict' | 'certified';

/**
 * Configuration section name in VS Code settings
 */
export const CONFIGURATION_SECTION = 'rqml';

/**
 * An active model selection: which provider and which model ID.
 */
export interface ActiveModel {
  providerId: ProviderId;
  modelId: string;
}

// ── Legacy types (kept for one-time migration from the pre-0.2 architecture) ──

/** @deprecated Replaced by ProviderId + ActiveModel. Kept for migration. */
export type LlmProvider = 'openai' | 'anthropic' | 'azure-openai' | 'ollama' | 'none';

/** @deprecated Replaced by per-provider `provider-key-{providerId}` secrets. Kept for migration. */
export type SecretKey =
  | 'openai-api-key'
  | 'anthropic-api-key'
  | 'azure-openai-api-key'
  | 'azure-openai-endpoint';

/** @deprecated Endpoints are no longer multi-instance. Kept for migration. */
export interface LlmEndpoint {
  id: string;
  provider: 'openai' | 'anthropic' | 'azure-openai' | 'google';
  name: string;
  model?: string;
}
