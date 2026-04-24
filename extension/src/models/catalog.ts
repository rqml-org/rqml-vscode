// REQ-MDL-001: Default model catalog
// REQ-MDL-012: Catalog extensibility — provider key is not hard-coded
// REQ-CFG-013: Singleton-per-provider architecture

import type { ProviderId } from '../types/configuration';

/**
 * REQ-MDL-001 AC-MDL-001-02: Model capabilities
 */
export type ModelCapability = 'chat' | 'code' | 'vision' | 'function-calling' | 'reasoning' | 'web-search';

/**
 * REQ-CFG-013: A provider in the curated catalog.
 *
 * Providers are singletons — at most one configured instance per id.
 * A provider is considered "available" when either:
 *   - the corresponding env var is set, or
 *   - a stored API key has been saved via VS Code SecretStorage.
 */
export interface ProviderEntry {
  /** Internal identifier (stable, used as key in settings and secret storage) */
  id: ProviderId;
  /** User-visible name */
  displayName: string;
  /** Env vars checked (in order) when no stored key exists. First match wins. */
  envVars: string[];
  /** Hint shown in the API key input box */
  keyPlaceholder?: string;
  /** Docs URL for obtaining a key */
  docsUrl?: string;
  /** Vercel AI SDK module path (used for dynamic import) */
  sdkModule: string;
  /** Name of the SDK factory export (e.g. `createOpenAI`) */
  sdkFactory: string;
  /** Whether this provider also needs an endpoint URL (e.g. Azure OpenAI) */
  requiresEndpointUrl?: boolean;
  /** Env var for the endpoint URL when `requiresEndpointUrl` is true */
  endpointUrlEnvVar?: string;
}

/**
 * REQ-MDL-001 AC-MDL-001-02: Catalog entry metadata
 */
export interface ModelCatalogEntry {
  /** The identifier passed to the provider SDK (e.g. "gpt-4o") */
  modelId: string;
  /** Human-readable name (e.g. "GPT-4o") */
  displayName: string;
  /** The provider this model belongs to */
  provider: ProviderId;
  /** Supported capabilities */
  capabilities: ModelCapability[];
  /** Context window size in tokens */
  contextWindow: number;
  /** Whether this model is a suggested default for its provider */
  recommended: boolean;
}

/**
 * REQ-CFG-013 AC-CFG-013-01: Curated provider catalog.
 *
 * All providers are predefined. Adding a new provider requires a code change
 * here and in the dependencies — users cannot add custom providers.
 */
export const PROVIDERS: readonly ProviderEntry[] = [
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    envVars: ['ANTHROPIC_API_KEY'],
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    sdkModule: '@ai-sdk/anthropic',
    sdkFactory: 'createAnthropic',
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    envVars: ['OPENAI_API_KEY'],
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    sdkModule: '@ai-sdk/openai',
    sdkFactory: 'createOpenAI',
  },
  {
    id: 'google',
    displayName: 'Google (Gemini)',
    envVars: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    keyPlaceholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/apikey',
    sdkModule: '@ai-sdk/google',
    sdkFactory: 'createGoogleGenerativeAI',
  },
  {
    id: 'azure-openai',
    displayName: 'Azure OpenAI',
    envVars: ['AZURE_API_KEY', 'AZURE_OPENAI_API_KEY'],
    keyPlaceholder: 'Azure API key',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/',
    sdkModule: '@ai-sdk/azure',
    sdkFactory: 'createAzure',
    requiresEndpointUrl: true,
    endpointUrlEnvVar: 'AZURE_RESOURCE_NAME',
  },
  {
    id: 'xai',
    displayName: 'xAI (Grok)',
    envVars: ['XAI_API_KEY'],
    keyPlaceholder: 'xai-...',
    docsUrl: 'https://docs.x.ai/',
    sdkModule: '@ai-sdk/xai',
    sdkFactory: 'createXai',
  },
  {
    id: 'mistral',
    displayName: 'Mistral',
    envVars: ['MISTRAL_API_KEY'],
    keyPlaceholder: 'Mistral API key',
    docsUrl: 'https://console.mistral.ai/api-keys/',
    sdkModule: '@ai-sdk/mistral',
    sdkFactory: 'createMistral',
  },
  {
    id: 'groq',
    displayName: 'Groq',
    envVars: ['GROQ_API_KEY'],
    keyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    sdkModule: '@ai-sdk/groq',
    sdkFactory: 'createGroq',
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    envVars: ['DEEPSEEK_API_KEY'],
    keyPlaceholder: 'DeepSeek API key',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    sdkModule: '@ai-sdk/deepseek',
    sdkFactory: 'createDeepSeek',
  },
  {
    id: 'perplexity',
    displayName: 'Perplexity',
    envVars: ['PERPLEXITY_API_KEY'],
    keyPlaceholder: 'pplx-...',
    docsUrl: 'https://docs.perplexity.ai/',
    sdkModule: '@ai-sdk/perplexity',
    sdkFactory: 'createPerplexity',
  },
];

/**
 * Look up a provider entry by id.
 */
export function getProvider(id: ProviderId): ProviderEntry | undefined {
  return PROVIDERS.find(p => p.id === id);
}

/**
 * REQ-MDL-001 AC-MDL-001-01: Built-in model catalog spanning all providers.
 * REQ-MDL-001 AC-MDL-001-03: At least one recommended model per provider.
 */
export const DEFAULT_CATALOG: readonly ModelCatalogEntry[] = [
  // ── Anthropic ──
  {
    modelId: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling', 'reasoning'],
    contextWindow: 200_000,
    recommended: true,
  },
  {
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling', 'reasoning'],
    contextWindow: 200_000,
    recommended: false,
  },
  {
    modelId: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 200_000,
    recommended: false,
  },
  {
    modelId: 'claude-sonnet-4-5-20250929',
    displayName: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 200_000,
    recommended: false,
  },
  {
    modelId: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 200_000,
    recommended: false,
  },

  // ── OpenAI ──
  {
    modelId: 'gpt-5.4',
    displayName: 'GPT-5.4',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_050_000,
    recommended: true,
  },
  {
    modelId: 'gpt-5.4-pro',
    displayName: 'GPT-5.4 Pro',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_050_000,
    recommended: false,
  },
  {
    modelId: 'gpt-5.2',
    displayName: 'GPT-5.2',
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
    modelId: 'gpt-4.1',
    displayName: 'GPT-4.1',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_047_576,
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
    displayName: 'GPT-4o mini',
    provider: 'openai',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 128_000,
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

  // ── Google (Gemini) ──
  {
    modelId: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision', 'function-calling', 'reasoning'],
    contextWindow: 1_048_576,
    recommended: true,
  },
  {
    modelId: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
    contextWindow: 1_048_576,
    recommended: false,
  },
  {
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision', 'function-calling', 'reasoning'],
    contextWindow: 1_048_576,
    recommended: false,
  },
  {
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    capabilities: ['chat', 'code', 'vision', 'function-calling'],
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

  // ── Azure OpenAI ──
  // Note: Azure "model IDs" are actually deployment names configured in the user's
  // Azure resource. The entries below represent common OpenAI deployments; the user
  // may need to rename them to match their own Azure deployment names.
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
    displayName: 'GPT-4o mini (Azure)',
    provider: 'azure-openai',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 128_000,
    recommended: false,
  },

  // ── xAI (Grok) ──
  {
    modelId: 'grok-4',
    displayName: 'Grok 4',
    provider: 'xai',
    capabilities: ['chat', 'code', 'vision', 'function-calling', 'reasoning'],
    contextWindow: 256_000,
    recommended: true,
  },
  {
    modelId: 'grok-4-fast',
    displayName: 'Grok 4 Fast',
    provider: 'xai',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 256_000,
    recommended: false,
  },
  {
    modelId: 'grok-3',
    displayName: 'Grok 3',
    provider: 'xai',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'grok-3-mini',
    displayName: 'Grok 3 mini',
    provider: 'xai',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'grok-2-vision-1212',
    displayName: 'Grok 2 Vision',
    provider: 'xai',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 32_768,
    recommended: false,
  },

  // ── Mistral ──
  {
    modelId: 'mistral-large-latest',
    displayName: 'Mistral Large',
    provider: 'mistral',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: true,
  },
  {
    modelId: 'mistral-medium-latest',
    displayName: 'Mistral Medium',
    provider: 'mistral',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'mistral-small-latest',
    displayName: 'Mistral Small',
    provider: 'mistral',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'codestral-latest',
    displayName: 'Codestral',
    provider: 'mistral',
    capabilities: ['code'],
    contextWindow: 256_000,
    recommended: false,
  },
  {
    modelId: 'pixtral-large-latest',
    displayName: 'Pixtral Large',
    provider: 'mistral',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'ministral-8b-latest',
    displayName: 'Ministral 8B',
    provider: 'mistral',
    capabilities: ['chat', 'code'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'ministral-3b-latest',
    displayName: 'Ministral 3B',
    provider: 'mistral',
    capabilities: ['chat'],
    contextWindow: 131_072,
    recommended: false,
  },

  // ── Groq (fast inference of open-weight models) ──
  {
    modelId: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B',
    provider: 'groq',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: true,
  },
  {
    modelId: 'llama-3.1-70b-versatile',
    displayName: 'Llama 3.1 70B',
    provider: 'groq',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B (instant)',
    provider: 'groq',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'mixtral-8x7b-32768',
    displayName: 'Mixtral 8x7B',
    provider: 'groq',
    capabilities: ['chat', 'code'],
    contextWindow: 32_768,
    recommended: false,
  },
  {
    modelId: 'deepseek-r1-distill-llama-70b',
    displayName: 'DeepSeek R1 Distill Llama 70B',
    provider: 'groq',
    capabilities: ['chat', 'reasoning'],
    contextWindow: 131_072,
    recommended: false,
  },
  {
    modelId: 'qwen-qwq-32b',
    displayName: 'Qwen QwQ 32B',
    provider: 'groq',
    capabilities: ['chat', 'code', 'reasoning'],
    contextWindow: 131_072,
    recommended: false,
  },

  // ── DeepSeek ──
  {
    modelId: 'deepseek-chat',
    displayName: 'DeepSeek Chat (V3)',
    provider: 'deepseek',
    capabilities: ['chat', 'code', 'function-calling'],
    contextWindow: 131_072,
    recommended: true,
  },
  {
    modelId: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner (R1)',
    provider: 'deepseek',
    capabilities: ['chat', 'reasoning'],
    contextWindow: 131_072,
    recommended: false,
  },

  // ── Perplexity ──
  {
    modelId: 'sonar-pro',
    displayName: 'Sonar Pro',
    provider: 'perplexity',
    capabilities: ['chat', 'web-search'],
    contextWindow: 200_000,
    recommended: true,
  },
  {
    modelId: 'sonar',
    displayName: 'Sonar',
    provider: 'perplexity',
    capabilities: ['chat', 'web-search'],
    contextWindow: 128_000,
    recommended: false,
  },
  {
    modelId: 'sonar-reasoning-pro',
    displayName: 'Sonar Reasoning Pro',
    provider: 'perplexity',
    capabilities: ['chat', 'reasoning', 'web-search'],
    contextWindow: 128_000,
    recommended: false,
  },
  {
    modelId: 'sonar-reasoning',
    displayName: 'Sonar Reasoning',
    provider: 'perplexity',
    capabilities: ['chat', 'reasoning', 'web-search'],
    contextWindow: 128_000,
    recommended: false,
  },
  {
    modelId: 'sonar-deep-research',
    displayName: 'Sonar Deep Research',
    provider: 'perplexity',
    capabilities: ['chat', 'reasoning', 'web-search'],
    contextWindow: 128_000,
    recommended: false,
  },
];
