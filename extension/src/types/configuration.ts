// REQ-CFG-004: Configuration types for RQML extension
// REQ-CFG-005: VS Code theme integration (no custom palettes)

/**
 * REQ-CFG-004: Supported LLM providers
 */
export type LlmProvider = 'openai' | 'anthropic' | 'azure-openai' | 'ollama' | 'none';

/**
 * REQ-CFG-003: Secret keys stored in SecretStorage
 */
export type SecretKey =
  | 'openai-api-key'
  | 'anthropic-api-key'
  | 'azure-openai-api-key'
  | 'azure-openai-endpoint';

/**
 * REQ-AGT-013: Strictness levels for agent behaviour
 */
export type StrictnessLevel = 'relaxed' | 'standard' | 'strict' | 'certified';

/**
 * REQ-CFG-008: LLM endpoint configuration
 */
export interface LlmEndpoint {
  id: string;
  provider: 'openai' | 'anthropic' | 'azure-openai' | 'google';
  name: string;
  model?: string;
}

/**
 * Configuration section name in VS Code settings
 */
export const CONFIGURATION_SECTION = 'rqml';
