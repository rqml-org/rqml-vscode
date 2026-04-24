// REQ-AGT-003: Vercel AI SDK integration
// REQ-CFG-013: Singleton-per-provider architecture
// REQ-MDL-005: Catalog-driven model routing
// REQ-MDL-006: Model unavailability error handling

import * as vscode from 'vscode';
import { getConfigurationService } from './configurationService';
import { getModelCatalogService } from './modelCatalogService';

type LanguageModel = import('ai').LanguageModel;

/**
 * LlmService — Provides LLM communication via the Vercel AI SDK.
 *
 * The active model is a single global `{providerId, modelId}` pair maintained
 * by ConfigurationService. The provider's key is resolved per call (env or
 * stored secret).
 */
export class LlmService {
  private disposables: vscode.Disposable[] = [];

  /**
   * REQ-AGT-003: Create a language model instance for the active model.
   */
  async getModel(): Promise<LanguageModel> {
    const config = getConfigurationService();
    const catalog = getModelCatalogService();

    const active = config.getActiveModel();
    if (!active) {
      throw new Error(
        'No active model selected. Pick one from the model dropdown in the agent panel, ' +
        'or run "RQML: Select Model".'
      );
    }

    const apiKey = await config.getProviderApiKey(active.providerId);
    if (!apiKey) {
      const providerEntry = catalog.getProviderEntry(active.providerId);
      const providerName = providerEntry?.displayName || active.providerId;
      throw new Error(
        `No API key available for provider "${providerName}". ` +
        `Run "RQML: Add LLM Provider" to add one, or set ${providerEntry?.envVars.join(' / ') || 'an env var'}.`
      );
    }

    try {
      return await catalog.createModel(active.providerId, active.modelId, apiKey);
    } catch (err) {
      // REQ-MDL-006: Suggest alternatives from the same provider
      const alternatives = catalog
        .getModelsForProvider(active.providerId)
        .filter(m => m.modelId !== active.modelId)
        .slice(0, 3)
        .map(m => m.displayName)
        .join(', ');
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Model "${active.modelId}" unavailable: ${reason}` +
        (alternatives ? `\nAlternatives: ${alternatives}. Use "RQML: Select Model" to switch.` : '')
      );
    }
  }

  /**
   * Is an LLM ready to use? (Active model selected AND its provider has a key.)
   */
  async isReady(): Promise<boolean> {
    const config = getConfigurationService();
    const active = config.getActiveModel();
    if (!active) return false;
    const apiKey = await config.getProviderApiKey(active.providerId);
    return !!apiKey;
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton */
let llmServiceInstance: LlmService | undefined;

export function getLlmService(): LlmService {
  if (!llmServiceInstance) llmServiceInstance = new LlmService();
  return llmServiceInstance;
}
