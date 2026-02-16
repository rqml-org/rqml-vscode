// REQ-AGT-003: Vercel AI SDK integration
// REQ-CFG-010: Active endpoint selection
// REQ-MDL-005: Catalog-driven model routing
// REQ-MDL-006: Model unavailability error handling
// REQ-MDL-007: Fallback model

import * as vscode from 'vscode';
import { getConfigurationService } from './configurationService';
import { getModelCatalogService } from './modelCatalogService';

type LanguageModel = import('ai').LanguageModel;

/**
 * LlmService - Provides LLM communication via the Vercel AI SDK.
 * REQ-MDL-005: Uses the model catalog for provider-factory routing.
 */
export class LlmService {
  private disposables: vscode.Disposable[] = [];

  /**
   * REQ-AGT-003: Create a language model for the active endpoint.
   * REQ-MDL-005: Routes through the catalog service.
   */
  async getModel(): Promise<LanguageModel> {
    const configService = getConfigurationService();
    const catalogService = getModelCatalogService();
    const endpoint = configService.getActiveEndpoint();
    if (!endpoint) {
      throw new Error('No active LLM endpoint configured. Please add and select an endpoint in settings.');
    }

    const apiKey = await configService.getEndpointApiKey(endpoint.id);
    if (!apiKey) {
      throw new Error(`No API key found for endpoint "${endpoint.name}". Please reconfigure.`);
    }

    const modelId = catalogService.getSelectedModelId(endpoint);
    if (!modelId) {
      throw new Error(`No model selected for endpoint "${endpoint.name}". Use /model use to select one.`);
    }

    try {
      return await catalogService.createModelFromCatalog(endpoint.provider, modelId, apiKey);
    } catch (err) {
      // REQ-MDL-007: Try fallback if configured
      const fallbackId = catalogService.getFallbackModelId(endpoint.id);
      if (fallbackId && fallbackId !== modelId) {
        try {
          const model = await catalogService.createModelFromCatalog(endpoint.provider, fallbackId, apiKey);
          vscode.window.showWarningMessage(
            `Model "${modelId}" unavailable — using fallback "${fallbackId}".`
          );
          return model;
        } catch (fallbackErr) {
          // REQ-MDL-007 AC-MDL-007-03: Both failed
          const primary = err instanceof Error ? err.message : String(err);
          const fallback = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          throw new Error(
            `Both primary model "${modelId}" and fallback "${fallbackId}" failed.\n` +
            `Primary: ${primary}\nFallback: ${fallback}`
          );
        }
      }

      // REQ-MDL-006: Suggest alternatives
      const alternatives = catalogService.getAlternatives(endpoint.provider, modelId);
      const altNames = alternatives.slice(0, 3).map(a => a.displayName).join(', ');
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Model "${modelId}" unavailable: ${reason}` +
        (altNames ? `\nAlternatives: ${altNames}. Use /model use to switch.` : '')
      );
    }
  }

  /**
   * Check if an LLM endpoint is configured and ready
   */
  async isReady(): Promise<boolean> {
    const configService = getConfigurationService();
    const endpoint = configService.getActiveEndpoint();
    if (!endpoint) return false;
    const apiKey = await configService.getEndpointApiKey(endpoint.id);
    return !!apiKey;
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton */
let llmServiceInstance: LlmService | undefined;

export function getLlmService(): LlmService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LlmService();
  }
  return llmServiceInstance;
}
