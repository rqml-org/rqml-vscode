// REQ-CFG-001: Settings UI
// REQ-CFG-002: API key storage
// REQ-CFG-003: Secure API key storage via SecretStorage
// REQ-CFG-004: LLM provider selection
// REQ-CFG-005: Color palette selection
// REQ-CFG-007: Settings persistence

import * as vscode from 'vscode';
import {
  LlmProvider,
  ColorPalette,
  SecretKey,
  DEFAULT_COLOR_PALETTE,
  COLOR_PALETTES,
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

  // Built-in color palettes
  private readonly colorPalettes: Map<string, ColorPalette> = new Map(
    COLOR_PALETTES.map(p => [p.id, p])
  );

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

  /**
   * REQ-CFG-005: Get current color palette ID
   */
  getColorPaletteId(): string {
    return this.getConfig<string>('colorPalette', DEFAULT_COLOR_PALETTE.id);
  }

  /**
   * REQ-CFG-005, REQ-CFG-006: Get current color palette object
   */
  getColorPalette(): ColorPalette {
    const id = this.getColorPaletteId();
    return this.colorPalettes.get(id) || DEFAULT_COLOR_PALETTE;
  }

  /**
   * REQ-CFG-005: Set color palette
   */
  async setColorPaletteId(paletteId: string): Promise<void> {
    if (!this.colorPalettes.has(paletteId)) {
      throw new Error(`Unknown color palette: ${paletteId}`);
    }
    await this.setConfig('colorPalette', paletteId);
  }

  /**
   * Get all available color palettes
   */
  getAvailablePalettes(): ColorPalette[] {
    return Array.from(this.colorPalettes.values());
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
