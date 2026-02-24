// REQ-MDL-001 through REQ-MDL-012: Model Catalog and Selection
//
// Central service for catalog management, model resolution, QuickPick picker,
// and Vercel AI SDK routing.

import * as vscode from 'vscode';
import {
  DEFAULT_CATALOG,
  PROVIDER_SDK_MAP,
  type ModelCatalogEntry,
  type ModelCustomization,
  type CustomModelEntry,
} from '../models/catalog';
import { getConfigurationService } from './configurationService';
import { CONFIGURATION_SECTION, type LlmEndpoint } from '../types/configuration';

type ConfigurationService = ReturnType<typeof getConfigurationService>;

type LanguageModel = import('ai').LanguageModel;

/**
 * REQ-MDL-001, REQ-MDL-002: Build the effective catalog by merging
 * default entries with user customizations.
 */
export class ModelCatalogService {
  private disposables: vscode.Disposable[] = [];

  // ========== Effective Catalog (REQ-MDL-001, REQ-MDL-002) ==========

  /**
   * REQ-MDL-002 AC-MDL-002-01/02/03: Merge default catalog with user additions,
   * hides, and overrides to produce the effective catalog.
   */
  getEffectiveCatalog(): ModelCatalogEntry[] {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);

    const hiddenSet = new Set<string>(
      config.get<string[]>('modelCatalog.hiddenModels', [])
    );
    const overrides = config.get<Record<string, ModelCustomization>>(
      'modelCatalog.overrides', {}
    );
    const customModels = config.get<CustomModelEntry[]>(
      'modelCatalog.customModels', []
    );

    // Start with defaults, apply hides and overrides
    const entries: ModelCatalogEntry[] = [];
    for (const entry of DEFAULT_CATALOG) {
      const key = `${entry.provider}/${entry.modelId}`;
      if (hiddenSet.has(key)) continue;

      const override = overrides[key];
      if (override) {
        entries.push({
          ...entry,
          displayName: override.displayName ?? entry.displayName,
          capabilities: override.capabilities ?? entry.capabilities,
          contextWindow: override.contextWindow ?? entry.contextWindow,
        });
      } else {
        entries.push({ ...entry });
      }
    }

    // Append user-added custom models
    for (const custom of customModels) {
      entries.push({
        modelId: custom.modelId,
        displayName: custom.displayName || custom.modelId,
        provider: custom.provider,
        capabilities: custom.capabilities || ['chat'],
        contextWindow: custom.contextWindow || 0,
        recommended: false,
      });
    }

    return entries;
  }

  /**
   * Get catalog entries for a specific provider.
   */
  getModelsForProvider(provider: string): ModelCatalogEntry[] {
    return this.getEffectiveCatalog().filter(e => e.provider === provider);
  }

  /**
   * Get all unique provider keys in the effective catalog.
   */
  getProviders(): string[] {
    const set = new Set(this.getEffectiveCatalog().map(e => e.provider));
    return [...set];
  }

  /**
   * Get the effective catalog filtered to only providers that have at least
   * one configured endpoint with a stored API key.
   */
  async getAvailableCatalog(): Promise<ModelCatalogEntry[]> {
    const configService = getConfigurationService();
    const endpoints = configService.getEndpoints();
    const availableProviders = new Set<string>();

    for (const ep of endpoints) {
      const key = await configService.getEndpointApiKey(ep.id);
      if (key) {
        availableProviders.add(ep.provider);
      }
    }

    return this.getEffectiveCatalog().filter(e => availableProviders.has(e.provider));
  }

  /**
   * REQ-MDL-004 AC-MDL-004-02: Get the recommended model for a provider.
   */
  getRecommendedModel(provider: string): ModelCatalogEntry | undefined {
    return this.getModelsForProvider(provider).find(e => e.recommended);
  }

  /**
   * Find a catalog entry by model ID (optionally scoped to a provider).
   * Case-insensitive matching.
   */
  findModel(modelId: string, provider?: string): ModelCatalogEntry | undefined {
    const catalog = provider
      ? this.getModelsForProvider(provider)
      : this.getEffectiveCatalog();
    const lower = modelId.toLowerCase();
    return catalog.find(e => e.modelId.toLowerCase() === lower);
  }

  /**
   * REQ-MDL-009 AC-MDL-009-03: Find models matching a partial name or ID.
   */
  searchModels(query: string, provider?: string): ModelCatalogEntry[] {
    const catalog = provider
      ? this.getModelsForProvider(provider)
      : this.getEffectiveCatalog();
    const lower = query.toLowerCase();
    return catalog.filter(
      e => e.modelId.toLowerCase().includes(lower) ||
           e.displayName.toLowerCase().includes(lower)
    );
  }

  // ========== Model Selection (REQ-MDL-004) ==========

  /**
   * REQ-MDL-004 AC-MDL-004-01: Get the selected model ID for an endpoint.
   * Falls back to the recommended model for the endpoint's provider.
   */
  getSelectedModelId(endpoint: LlmEndpoint): string {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    const selections = config.get<Record<string, string>>('modelSelections', {});

    // Check per-endpoint selection — validate it belongs to this endpoint's provider
    const stored = selections[endpoint.id];
    if (stored) {
      const entry = this.findModel(stored);
      if (!entry || entry.provider === endpoint.provider) {
        return stored;
      }
      // Stored model belongs to a different provider; ignore it
    }

    // Check endpoint.model (legacy field)
    if (endpoint.model) {
      return endpoint.model;
    }

    // Fallback to recommended
    const rec = this.getRecommendedModel(endpoint.provider);
    return rec?.modelId ?? '';
  }

  /**
   * REQ-MDL-004: Persist selected model for an endpoint.
   */
  async setSelectedModelId(endpointId: string, modelId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    const selections = { ...config.get<Record<string, string>>('modelSelections', {}) };
    selections[endpointId] = modelId;
    await config.update('modelSelections', selections, vscode.ConfigurationTarget.Global);
  }

  /**
   * Select a model entry, switching the active endpoint if the model's provider
   * differs from the current endpoint.
   */
  async selectModelEntry(entry: ModelCatalogEntry, currentEndpoint: LlmEndpoint): Promise<void> {
    const target = await this.resolveEndpointForProvider(entry.provider, currentEndpoint);
    await this.setSelectedModelId(target.id, entry.modelId);
  }

  /**
   * REQ-MDL-004: Get the resolved catalog entry for an endpoint's active model.
   */
  getActiveModel(endpoint: LlmEndpoint): ModelCatalogEntry | undefined {
    const modelId = this.getSelectedModelId(endpoint);
    return this.findModel(modelId, endpoint.provider);
  }

  // ========== Fallback (REQ-MDL-007) ==========

  /**
   * REQ-MDL-007: Get the fallback model ID for an endpoint, if configured.
   */
  getFallbackModelId(endpointId: string): string | undefined {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    const fallbacks = config.get<Record<string, string>>('modelCatalog.fallbackModels', {});
    return fallbacks[endpointId] || undefined;
  }

  // ========== SDK Routing (REQ-MDL-005) ==========

  /**
   * REQ-MDL-005 AC-MDL-005-01: Create a Vercel AI SDK LanguageModel from a catalog entry.
   * REQ-MDL-012 AC-MDL-012-02: Uses configuration-driven provider-to-factory mapping.
   */
  async createModelFromCatalog(
    provider: string,
    modelId: string,
    apiKey: string
  ): Promise<LanguageModel> {
    const mapping = PROVIDER_SDK_MAP[provider];
    if (!mapping) {
      throw new Error(`No SDK mapping for provider "${provider}". Supported: ${Object.keys(PROVIDER_SDK_MAP).join(', ')}`);
    }

    // Dynamic import of the provider SDK module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(mapping.module);
    const factory = mod[mapping.factory];
    if (typeof factory !== 'function') {
      throw new Error(`Factory "${mapping.factory}" not found in "${mapping.module}".`);
    }

    const providerInstance = factory({ apiKey });
    return providerInstance(modelId);
  }

  // ========== QuickPick (REQ-MDL-003) ==========

  /**
   * REQ-MDL-003: Show a VS Code QuickPick model picker.
   * Shows all models from available providers, grouped by provider with separators.
   * If the picked model belongs to a different provider, the active endpoint is
   * switched automatically and the selection stored against the new endpoint.
   * Returns the selected model entry, or undefined if cancelled.
   */
  async showModelPicker(endpoint: LlmEndpoint): Promise<ModelCatalogEntry | undefined> {
    const catalog = await this.getAvailableCatalog();
    if (catalog.length === 0) {
      vscode.window.showWarningMessage('No models available. Ensure at least one endpoint has an API key configured.');
      return undefined;
    }

    const currentModelId = this.getSelectedModelId(endpoint);

    // Group by provider
    const byProvider = new Map<string, ModelCatalogEntry[]>();
    for (const entry of catalog) {
      const list = byProvider.get(entry.provider) || [];
      list.push(entry);
      byProvider.set(entry.provider, list);
    }

    // REQ-MDL-003 AC-MDL-003-01/03: Build QuickPick items with provider separators
    const items: (vscode.QuickPickItem & { entry?: ModelCatalogEntry })[] = [];
    for (const [provider, models] of byProvider) {
      items.push({ label: provider.toUpperCase(), kind: vscode.QuickPickItemKind.Separator });
      for (const entry of models) {
        const isCurrent = entry.modelId === currentModelId && entry.provider === endpoint.provider;
        const caps = entry.capabilities.join(', ');
        const ctxSize = entry.contextWindow > 0
          ? `${Math.round(entry.contextWindow / 1000)}k`
          : '?';
        items.push({
          label: `${isCurrent ? '$(check) ' : ''}${entry.displayName}`,
          description: `${entry.provider} · ${entry.modelId}`,
          detail: `Context: ${ctxSize} tokens | Capabilities: ${caps}${entry.recommended ? ' | Recommended' : ''}`,
          entry,
        });
      }
    }

    // REQ-MDL-003 AC-MDL-003-04: Type-ahead filtering is built into QuickPick
    const picked = await vscode.window.showQuickPick(items, {
      title: 'Select Model',
      placeHolder: 'Search by model name, ID, or provider...',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    const pickedEntry = (picked as { entry?: ModelCatalogEntry })?.entry;
    if (!pickedEntry) return undefined;

    await this.selectModelEntry(pickedEntry, endpoint);
    return pickedEntry;
  }

  /**
   * Find (or keep) an endpoint matching the given provider.
   * If the current endpoint already matches, returns it.
   * Otherwise finds the first keyed endpoint for the provider and switches to it.
   */
  private async resolveEndpointForProvider(
    provider: string,
    currentEndpoint: LlmEndpoint
  ): Promise<LlmEndpoint> {
    if (currentEndpoint.provider === provider) return currentEndpoint;

    const configService = getConfigurationService();
    const endpoints = configService.getEndpoints();
    for (const ep of endpoints) {
      if (ep.provider === provider) {
        const key = await configService.getEndpointApiKey(ep.id);
        if (key) {
          await configService.setActiveEndpointId(ep.id);
          return ep;
        }
      }
    }

    // Shouldn't happen if getAvailableCatalog filtered correctly, but fallback
    return currentEndpoint;
  }

  // ========== Error Handling Helpers (REQ-MDL-006) ==========

  /**
   * REQ-MDL-006 AC-MDL-006-01: Get alternative models from the same provider.
   */
  getAlternatives(provider: string, excludeModelId: string): ModelCatalogEntry[] {
    return this.getModelsForProvider(provider)
      .filter(e => e.modelId !== excludeModelId);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton */
let instance: ModelCatalogService | undefined;

export function getModelCatalogService(): ModelCatalogService {
  if (!instance) {
    instance = new ModelCatalogService();
  }
  return instance;
}
