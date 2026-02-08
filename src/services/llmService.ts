// REQ-AGT-003: Vercel AI SDK integration
// REQ-CFG-010: Active endpoint selection

import * as vscode from 'vscode';
import { getConfigurationService } from './configurationService';
import type { LlmEndpoint } from '../types/configuration';

// Dynamic imports for AI SDK providers to handle optional dependencies
type LanguageModel = import('ai').LanguageModel;

/**
 * LlmService - Provides LLM communication via the Vercel AI SDK.
 * Uses the active endpoint from ConfigurationService.
 */
export class LlmService {
  private disposables: vscode.Disposable[] = [];

  /**
   * REQ-AGT-003: Create a language model for the active endpoint
   */
  async getModel(): Promise<LanguageModel> {
    const configService = getConfigurationService();
    const endpoint = configService.getActiveEndpoint();
    if (!endpoint) {
      throw new Error('No active LLM endpoint configured. Please add and select an endpoint in settings.');
    }

    const apiKey = await configService.getEndpointApiKey(endpoint.id);
    if (!apiKey) {
      throw new Error(`No API key found for endpoint "${endpoint.name}". Please reconfigure.`);
    }

    return this.createModel(endpoint, apiKey);
  }

  /**
   * REQ-AGT-003 AC-AGT-003-02: Create a model from endpoint config — switching providers needs no code changes
   */
  private async createModel(endpoint: LlmEndpoint, apiKey: string): Promise<LanguageModel> {
    const modelId = endpoint.model || this.getDefaultModel(endpoint.provider);

    switch (endpoint.provider) {
      case 'openai': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        const openai = createOpenAI({ apiKey });
        return openai(modelId);
      }
      case 'anthropic': {
        const { createAnthropic } = await import('@ai-sdk/anthropic');
        const anthropic = createAnthropic({ apiKey });
        return anthropic(modelId);
      }
      case 'azure-openai': {
        const { createAzure } = await import('@ai-sdk/azure');
        const azure = createAzure({ apiKey });
        return azure(modelId);
      }
      case 'google': {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const google = createGoogleGenerativeAI({ apiKey });
        return google(modelId);
      }
      default:
        throw new Error(`Unsupported provider: ${endpoint.provider}`);
    }
  }

  private getDefaultModel(provider: LlmEndpoint['provider']): string {
    switch (provider) {
      case 'openai': return 'gpt-4o';
      case 'anthropic': return 'claude-sonnet-4-5-20250929';
      case 'azure-openai': return 'gpt-4o';
      case 'google': return 'gemini-2.0-flash';
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
