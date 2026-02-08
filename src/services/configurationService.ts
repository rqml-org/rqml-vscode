// REQ-CFG-001: Settings UI
// REQ-CFG-002: API key storage
// REQ-CFG-003: Secure API key storage via SecretStorage
// REQ-CFG-004: LLM provider selection
// REQ-CFG-005: VS Code theme integration (no custom palettes)
// REQ-CFG-007: Settings persistence
// REQ-CFG-008 through REQ-CFG-012: LLM endpoint management
// REQ-AGT-013, REQ-AGT-014: Strictness levels

import * as vscode from 'vscode';
import {
  LlmProvider,
  SecretKey,
  LlmEndpoint,
  StrictnessLevel,
  CONFIGURATION_SECTION
} from '../types/configuration';

/**
 * ConfigurationService - Manages extension settings and secrets.
 * Follows the singleton pattern established in specService.ts and diagnosticsService.ts.
 */
export class ConfigurationService {
  private _onDidChangeConfiguration = new vscode.EventEmitter<vscode.ConfigurationChangeEvent>();
  readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

  private _onDidChangeSecrets = new vscode.EventEmitter<SecretKey>();
  readonly onDidChangeSecrets = this._onDidChangeSecrets.event;

  private secretStorage: vscode.SecretStorage | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Listen for workspace configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
          this._onDidChangeConfiguration.fire(event);
        }
      })
    );
  }

  /**
   * Initialize with extension context (required for SecretStorage).
   * Must be called during extension activation.
   */
  initialize(context: vscode.ExtensionContext): void {
    this.secretStorage = context.secrets;
  }

  // ========== Regular Configuration (workspace.getConfiguration) ==========

  /**
   * REQ-CFG-004: Get currently selected LLM provider
   */
  getLlmProvider(): LlmProvider {
    return this.getConfig<LlmProvider>('llmProvider', 'none');
  }

  /**
   * REQ-CFG-004: Set LLM provider
   */
  async setLlmProvider(provider: LlmProvider): Promise<void> {
    await this.setConfig('llmProvider', provider);
  }

  // ========== Secrets (SecretStorage API) ==========

  /**
   * REQ-CFG-002, REQ-CFG-003: Get API key from secure storage
   */
  async getApiKey(key: SecretKey): Promise<string | undefined> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized. Call initialize() first.');
    }
    return this.secretStorage.get(key);
  }

  /**
   * REQ-CFG-002, REQ-CFG-003: Store API key in secure storage
   */
  async setApiKey(key: SecretKey, value: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized. Call initialize() first.');
    }
    await this.secretStorage.store(key, value);
    this._onDidChangeSecrets.fire(key);
  }

  /**
   * REQ-CFG-003: Delete API key from secure storage
   */
  async deleteApiKey(key: SecretKey): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized. Call initialize() first.');
    }
    await this.secretStorage.delete(key);
    this._onDidChangeSecrets.fire(key);
  }

  /**
   * Check if an API key exists (without exposing the value)
   */
  async hasApiKey(key: SecretKey): Promise<boolean> {
    const value = await this.getApiKey(key);
    return value !== undefined && value.length > 0;
  }

  /**
   * Get the appropriate API key for the currently selected provider
   */
  async getActiveProviderApiKey(): Promise<string | undefined> {
    const provider = this.getLlmProvider();
    switch (provider) {
      case 'openai':
        return this.getApiKey('openai-api-key');
      case 'anthropic':
        return this.getApiKey('anthropic-api-key');
      case 'azure-openai':
        return this.getApiKey('azure-openai-api-key');
      case 'ollama':
        return undefined; // Ollama typically doesn't need API key
      default:
        return undefined;
    }
  }

  /**
   * Get the secret key name for a given provider
   */
  getSecretKeyForProvider(provider: LlmProvider): SecretKey | undefined {
    switch (provider) {
      case 'openai':
        return 'openai-api-key';
      case 'anthropic':
        return 'anthropic-api-key';
      case 'azure-openai':
        return 'azure-openai-api-key';
      default:
        return undefined;
    }
  }

  // ========== LLM Endpoints (REQ-CFG-008 through REQ-CFG-012) ==========

  private _onDidChangeEndpoints = new vscode.EventEmitter<void>();
  readonly onDidChangeEndpoints = this._onDidChangeEndpoints.event;

  /**
   * REQ-CFG-008: Get all configured LLM endpoints
   */
  getEndpoints(): LlmEndpoint[] {
    return this.getConfig<LlmEndpoint[]>('llmEndpoints', []);
  }

  /**
   * REQ-CFG-010: Get the active endpoint ID
   */
  getActiveEndpointId(): string {
    return this.getConfig<string>('activeEndpointId', '');
  }

  /**
   * REQ-CFG-010: Get the active endpoint configuration
   */
  getActiveEndpoint(): LlmEndpoint | undefined {
    const id = this.getActiveEndpointId();
    if (!id) return undefined;
    return this.getEndpoints().find(e => e.id === id);
  }

  /**
   * REQ-CFG-010: Set the active endpoint
   */
  async setActiveEndpointId(id: string): Promise<void> {
    await this.setConfig('activeEndpointId', id);
    this._onDidChangeEndpoints.fire();
  }

  /**
   * REQ-CFG-012: Add a new LLM endpoint
   */
  async addEndpoint(endpoint: LlmEndpoint, apiKey: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized.');
    }
    const endpoints = this.getEndpoints();
    endpoints.push(endpoint);
    await this.setConfig('llmEndpoints', endpoints);
    // Store API key securely, keyed by endpoint ID
    await this.secretStorage.store(`endpoint-key-${endpoint.id}`, apiKey);
    this._onDidChangeEndpoints.fire();
  }

  /**
   * REQ-CFG-011: Remove an LLM endpoint
   */
  async removeEndpoint(endpointId: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized.');
    }
    const endpoints = this.getEndpoints().filter(e => e.id !== endpointId);
    await this.setConfig('llmEndpoints', endpoints);
    // Delete associated API key
    await this.secretStorage.delete(`endpoint-key-${endpointId}`);
    // If the removed endpoint was active, clear the active selection
    if (this.getActiveEndpointId() === endpointId) {
      await this.setConfig('activeEndpointId', '');
    }
    this._onDidChangeEndpoints.fire();
  }

  /**
   * REQ-CFG-009: Get API key for a specific endpoint (full value, for LLM calls)
   */
  async getEndpointApiKey(endpointId: string): Promise<string | undefined> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized.');
    }
    return this.secretStorage.get(`endpoint-key-${endpointId}`);
  }

  /**
   * REQ-CFG-009: Get masked API key for display
   */
  async getEndpointApiKeyMasked(endpointId: string): Promise<string> {
    const key = await this.getEndpointApiKey(endpointId);
    if (!key) return '(no key)';
    if (key.length <= 4) return '••••';
    return '••••••••' + key.slice(-4);
  }

  // ========== Strictness (REQ-AGT-013, REQ-AGT-014) ==========

  /**
   * REQ-AGT-013: Get configured strictness from settings
   */
  getStrictnessSetting(): StrictnessLevel | '' {
    return this.getConfig<StrictnessLevel | ''>('agentStrictness', '');
  }

  /**
   * REQ-AGT-013: Set strictness level
   */
  async setStrictnessSetting(level: StrictnessLevel | ''): Promise<void> {
    await this.setConfig('agentStrictness', level);
  }

  // ========== Helper Methods ==========

  private getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    return config.get<T>(key, defaultValue);
  }

  private async setConfig<T>(key: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  dispose(): void {
    this._onDidChangeConfiguration.dispose();
    this._onDidChangeSecrets.dispose();
    this._onDidChangeEndpoints.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton instance */
let configurationServiceInstance: ConfigurationService | undefined;

export function getConfigurationService(): ConfigurationService {
  if (!configurationServiceInstance) {
    configurationServiceInstance = new ConfigurationService();
  }
  return configurationServiceInstance;
}
