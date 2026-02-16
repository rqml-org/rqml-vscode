// REQ-MDL-001: Default model catalog
// REQ-MDL-012: Catalog extensibility — provider key is not hard-coded

/**
 * REQ-MDL-001 AC-MDL-001-02: Model capabilities
 */
export type ModelCapability = 'chat' | 'code' | 'vision' | 'function-calling' | 'reasoning';

/**
 * REQ-MDL-001 AC-MDL-001-02: Catalog entry metadata
 */
export interface ModelCatalogEntry {
  /** The identifier passed to the provider SDK (e.g. "gpt-4o") */
  modelId: string;
  /** Human-readable name (e.g. "GPT-4o") */
  displayName: string;
  /** Provider key matching LlmEndpoint.provider */
  provider: string;
  /** Supported capabilities */
  capabilities: ModelCapability[];
  /** Context window size in tokens */
  contextWindow: number;
  /** Whether this model is a suggested default for its provider */
  recommended: boolean;
}

/**
 * REQ-MDL-002: User customisation for a catalog entry
 */
export interface ModelCustomization {
  /** Override display name */
  displayName?: string;
  /** Override capabilities */
  capabilities?: ModelCapability[];
  /** Override context window */
  contextWindow?: number;
}

/**
 * REQ-MDL-002: User-added custom model
 */
export interface CustomModelEntry {
  modelId: string;
  provider: string;
  displayName?: string;
  capabilities?: ModelCapability[];
  contextWindow?: number;
}

/**
 * REQ-MDL-001 AC-MDL-001-01: Built-in catalog with entries for OpenAI, Anthropic, Google, and Azure OpenAI.
 * REQ-MDL-001 AC-MDL-001-03: At least one recommended per provider.
 * REQ-MDL-012 AC-MDL-012-01: Provider key is a plain string, not a fixed enum.
 */
export const DEFAULT_CATALOG: readonly ModelCatalogEntry[] = [
  // --- OpenAI ---

  {
    modelId: 'gpt-5.2',
    displayName: 'GPT-5.2',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 400_000,
    recommended: true,
  },
  {
    modelId: 'gpt-5.2-pro',
    displayName: 'GPT-5.2 Pro',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 400_000,
    recommended: false,
  },
  {
    modelId: 'gpt-5.1',
    displayName: 'GPT-5.1',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 400_000,
    recommended: false,
  },
  {
    modelId: 'gpt-5',
    displayName: 'GPT-5',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 400_000,
    recommended: false,
  },
  {
    modelId: 'gpt-5-mini',
    displayName: 'GPT-5 mini',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 400_000,
    recommended: false,
  },
  {
    modelId: 'gpt-5-nano',
    displayName: 'GPT-5 nano',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 400_000,
    recommended: false,
  },
  {
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 128_000,
    recommended: false,
  },
  {
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 128_000,
    recommended: false,
  },
  {
    modelId: 'gpt-4.1',
    displayName: 'GPT-4.1',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_047_576,
    recommended: false,
  },
  {
    modelId: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_047_576,
    recommended: false,
  },
  {
    modelId: 'o3-mini',
    displayName: 'o3-mini',
    provider: 'openai',
    capabilities: ['chat', 'code', 'reasoning'],
    contextWindow: 200_000,
    recommended: false,
  },

  // --- Anthropic ---
  {
    modelId: 'claude-sonnet-4-5-20250929',
    displayName: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 200_000,
    recommended: false,
  },
  {
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling', 'reasoning'],
    contextWindow: 200_000,
    recommended: true,
  },
  {
    modelId: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 200_000,
    recommended: false,
  },

  // --- Google ---
  {
    modelId: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision','function-calling', 'reasoning'],
    contextWindow: 1_048_576,
    recommended: true,
  },
  {
    modelId: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision','function-calling'],
    contextWindow: 1_048_576,
    recommended: false,
  },
  {
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_048_576,
    recommended: false,
  },
  {
    modelId: 'gemini-2.5-pro-preview-05-06',
    displayName: 'Gemini 2.5 Pro',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision', 'function-calling', 'reasoning'],
    contextWindow: 1_048_576,
    recommended: false,
  },
  {
    modelId: 'gemini-2.5-flash-preview-04-17',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_048_576,
    recommended: false,
  },

  // --- Azure OpenAI ---
  {
    modelId: 'gpt-4o',
    displayName: 'GPT-4o (Azure)',
    provider: 'azure-openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 128_000,
    recommended: true,
  },
  {
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini (Azure)',
    provider: 'azure-openai',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 128_000,
    recommended: false,
  },
];

/**
 * REQ-MDL-012 AC-MDL-012-01: Provider-to-SDK-factory mapping.
 * Maps provider keys to the Vercel AI SDK import and factory function name.
 */
export const PROVIDER_SDK_MAP: Record<string, { module: string; factory: string }> = {
  'openai':       { module: '@ai-sdk/openai',   factory: 'createOpenAI' },
  'anthropic':    { module: '@ai-sdk/anthropic', factory: 'createAnthropic' },
  'azure-openai': { module: '@ai-sdk/azure',    factory: 'createAzure' },
  'google':       { module: '@ai-sdk/google',    factory: 'createGoogleGenerativeAI' },
};
