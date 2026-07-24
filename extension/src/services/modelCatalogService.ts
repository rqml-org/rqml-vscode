// REQ-MDL-001 through REQ-MDL-012: Model Catalog and Selection
// REQ-CFG-013: Singleton-per-provider architecture
//
// Central service for catalog access, provider/model routing, and the model
// picker UI. With the singleton-per-provider architecture (REQ-CFG-013),
// models are resolved to a provider via the catalog, and a single globally
// active model is tracked in ConfigurationService.

import * as vscode from 'vscode';
import {
  DEFAULT_CATALOG,
  PROVIDERS,
  getProvider,
  type ModelCatalogEntry,
  type ProviderEntry,
} from '../models/catalog';
import { loadProviderModule } from '../models/providerModules';
import { getConfigurationService } from './configurationService';
import { getGatewayModels } from './gatewayCatalogService';
import type { ProviderId } from '../types/configuration';

type LanguageModel = import('ai').LanguageModel;

export class ModelCatalogService {
  private disposables: vscode.Disposable[] = [];

  // ── Catalog access ──────────────────────────────────────────────────

  /**
   * Get the full built-in catalog. Customisation layers (hides, overrides,
   * custom models) have been removed — the curated list is authoritative.
   */
  getCatalog(): readonly ModelCatalogEntry[] {
    return DEFAULT_CATALOG;
  }

  /** All models for a specific provider. */
  getModelsForProvider(provider: ProviderId): ModelCatalogEntry[] {
    return DEFAULT_CATALOG.filter(e => e.provider === provider);
  }

  /**
   * REQ-CFG-013 AC-CFG-013-03: Models from providers that have a configured
   * key (stored or env var). This is what drives the model picker.
   */
  async getAvailableModels(): Promise<ModelCatalogEntry[]> {
    const config = getConfigurationService();
    const configured = new Set(await config.getConfiguredProviders());
    const models = DEFAULT_CATALOG.filter(m => configured.has(m.provider));

    // The gateway's models are fetched rather than curated: it offers 200+ and
    // the list changes without this extension shipping, so hard-coding them
    // would be stale within weeks. Appended only when the gateway is actually
    // configured — otherwise the picker gains hundreds of entries a user has no
    // key for.
    if (configured.has('vercel-gateway')) {
      const gatewayModels = await getGatewayModels();
      for (const entry of gatewayModels) {
        models.push({
          modelId: entry.modelId,
          displayName: `${entry.displayName} (via gateway)`,
          provider: 'vercel-gateway',
          capabilities: entry.reasoning
            ? ['chat', 'code', 'function-calling', 'reasoning']
            : ['chat', 'code', 'function-calling'],
          contextWindow: entry.contextWindow ?? 0,
          // Nothing here is "recommended": the gateway's catalogue is the
          // vendors' own, and picking a favourite among 200 would be arbitrary.
          recommended: false,
        });
      }
    }

    return models;
  }

  /** Recommended model for a provider (or the first one if no flag). */
  getRecommendedModel(provider: ProviderId): ModelCatalogEntry | undefined {
    const list = this.getModelsForProvider(provider);
    return list.find(e => e.recommended) || list[0];
  }

  /** Find a specific model by id (optionally scoped to a provider). */
  findModel(modelId: string, provider?: ProviderId): ModelCatalogEntry | undefined {
    const list = provider ? this.getModelsForProvider(provider) : DEFAULT_CATALOG;
    const lower = modelId.toLowerCase();
    return list.find(e => e.modelId.toLowerCase() === lower);
  }

  // ── Provider catalog access ─────────────────────────────────────────

  getProviders(): readonly ProviderEntry[] {
    return PROVIDERS;
  }

  getProviderEntry(id: ProviderId): ProviderEntry | undefined {
    return getProvider(id);
  }

  // ── SDK routing ─────────────────────────────────────────────────────

  /**
   * REQ-MDL-005: Create a Vercel AI SDK LanguageModel for the given
   * provider + model. Uses the provider's sdkModule/sdkFactory mapping
   * from the catalog.
   */
  async createModel(providerId: ProviderId, modelId: string, apiKey: string): Promise<LanguageModel> {
    const provider = getProvider(providerId);
    if (!provider) {
      throw new Error(`Unknown provider "${providerId}".`);
    }

    // Loaded through the static, exhaustive map in models/providerModules.ts
    // rather than `import(provider.sdkModule)`: a computed specifier is
    // invisible to packaging tools, which is how five providers shipped broken.
    const mod = await loadProviderModule(providerId, provider.displayName, provider.sdkModule);

    if (provider.kind === 'gateway') {
      // The gateway is constructed differently from every direct provider: its
      // factory returns a callable that takes a namespaced model id
      // ("anthropic/claude-…") and routes upstream. No baseURL is passed —
      // the SDK's default has moved between major versions, so hard-coding one
      // would pin this to whichever version happened to be installed.
      const createGateway = mod.createGateway;
      if (typeof createGateway !== 'function') {
        throw new Error(
          'createGateway was not found in the "ai" package. ' +
          'The AI SDK may have changed its export surface.',
        );
      }
      const gateway = (createGateway as (o: { apiKey: string }) => (id: string) => LanguageModel)({
        apiKey,
      });
      return gateway(modelId);
    }


    const factory = mod[provider.sdkFactory];
    if (typeof factory !== 'function') {
      throw new Error(
        `Factory "${provider.sdkFactory}" not found in "${provider.sdkModule}". ` +
        `The provider SDK may have changed its export surface.`,
      );
    }

    // Build the factory options. Azure requires additional config.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, any> = { apiKey };
    if (provider.requiresEndpointUrl) {
      const endpointUrl = await getConfigurationService().getProviderEndpointUrl(providerId);
      if (!endpointUrl) {
        throw new Error(
          `Provider "${provider.displayName}" requires an endpoint URL. ` +
          `Run RQML: Add LLM Provider to configure it.`
        );
      }
      // @ai-sdk/azure accepts either `resourceName` (for standard Azure URLs)
      // or `baseURL`. We pass what the user gave us verbatim as resourceName
      // if it looks like a bare name, otherwise as baseURL.
      if (/^https?:\/\//i.test(endpointUrl)) {
        options.baseURL = endpointUrl.replace(/\/+$/, '');
      } else {
        options.resourceName = endpointUrl;
      }
    }

    const providerInstance = factory(options);
    return providerInstance(modelId);
  }

  // ── Model picker UI ─────────────────────────────────────────────────

  /**
   * REQ-MDL-003: Show a QuickPick listing all models from providers with
   * a key available, grouped by provider. Sets the active model on
   * selection. Returns the picked entry, or undefined if cancelled.
   */
  async showModelPicker(): Promise<ModelCatalogEntry | undefined> {
    const config = getConfigurationService();
    const available = await this.getAvailableModels();

    if (available.length === 0) {
      const action = await vscode.window.showWarningMessage(
        'No LLM providers are configured. Add one to enable the agent.',
        'Add Provider',
      );
      if (action === 'Add Provider') {
        await vscode.commands.executeCommand('rqml-vscode.addLlmProvider');
      }
      return undefined;
    }

    const active = config.getActiveModel();
    const byProvider = new Map<ProviderId, ModelCatalogEntry[]>();
    for (const entry of available) {
      const list = byProvider.get(entry.provider) || [];
      list.push(entry);
      byProvider.set(entry.provider, list);
    }

    const items: (vscode.QuickPickItem & { entry?: ModelCatalogEntry })[] = [];
    for (const [providerId, models] of byProvider) {
      const provider = getProvider(providerId);
      items.push({
        label: provider?.displayName || providerId,
        kind: vscode.QuickPickItemKind.Separator,
      });
      for (const entry of models) {
        const isActive = active && active.providerId === entry.provider && active.modelId === entry.modelId;
        const caps = entry.capabilities.join(', ');
        const ctxSize = entry.contextWindow > 0
          ? `${Math.round(entry.contextWindow / 1000)}k`
          : '?';
        items.push({
          label: `${isActive ? '$(check) ' : ''}${entry.displayName}`,
          description: `${entry.provider} · ${entry.modelId}`,
          detail: `Context: ${ctxSize} tokens | ${caps}${entry.recommended ? ' | Recommended' : ''}`,
          entry,
        });
      }
    }

    const picked = await vscode.window.showQuickPick(items, {
      title: 'Select Active Model',
      placeHolder: 'Search by model name, ID, or provider…',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    const pickedEntry = (picked as { entry?: ModelCatalogEntry })?.entry;
    if (!pickedEntry) return undefined;

    await config.setActiveModel({
      providerId: pickedEntry.provider,
      modelId: pickedEntry.modelId,
    });
    return pickedEntry;
  }

  /**
   * Search models by partial name/id (case-insensitive).
   */
  searchModels(query: string, provider?: ProviderId): ModelCatalogEntry[] {
    const list = provider ? this.getModelsForProvider(provider) : [...DEFAULT_CATALOG];
    const lower = query.toLowerCase();
    return list.filter(e =>
      e.modelId.toLowerCase().includes(lower) ||
      e.displayName.toLowerCase().includes(lower)
    );
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton */
let instance: ModelCatalogService | undefined;

export function getModelCatalogService(): ModelCatalogService {
  if (!instance) instance = new ModelCatalogService();
  return instance;
}
