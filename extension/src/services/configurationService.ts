// REQ-CFG-001: Settings UI
// REQ-CFG-002: API key storage
// REQ-CFG-003: Secure API key storage via SecretStorage
// REQ-CFG-013: Provider singleton architecture (one key per provider)
// REQ-CFG-014: Environment variable auto-detection
// REQ-AGT-013, REQ-AGT-014: Strictness levels

import * as vscode from 'vscode';
import {
  ProviderId,
  ActiveModel,
  StrictnessLevel,
  CONFIGURATION_SECTION,
  type LlmEndpoint,
} from '../types/configuration';
import { getProvider, PROVIDERS } from '../models/catalog';

/** SecretStorage key prefix for the primary API key of a provider. */
const PROVIDER_KEY_PREFIX = 'provider-key-';
/** SecretStorage key prefix for the endpoint URL (used by Azure OpenAI). */
const PROVIDER_ENDPOINT_PREFIX = 'provider-endpoint-';

/** Source of a resolved API key. */
export type KeySource = 'env' | 'stored' | 'none';

/**
 * ConfigurationService — Manages extension settings and secrets.
 *
 * Design (from REQ-CFG-013):
 * - Providers are singletons — at most one API key per provider.
 * - Keys are resolved from SecretStorage first, falling back to env vars.
 * - There is one globally active model (a `{providerId, modelId}` pair).
 */
export class ConfigurationService {
  private _onDidChangeConfiguration = new vscode.EventEmitter<vscode.ConfigurationChangeEvent>();
  readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

  /**
   * REQ-CFG-013: Fired whenever provider configuration changes — a key is
   * added/removed or the active model changes.
   */
  private _onDidChangeProviders = new vscode.EventEmitter<void>();
  readonly onDidChangeProviders = this._onDidChangeProviders.event;

  private secretStorage: vscode.SecretStorage | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
          this._onDidChangeConfiguration.fire(event);
          if (
            event.affectsConfiguration(`${CONFIGURATION_SECTION}.activeModel`)
          ) {
            this._onDidChangeProviders.fire();
          }
        }
      })
    );
  }

  /**
   * Initialize with extension context (required for SecretStorage).
   * Also runs a one-time migration from the legacy multi-endpoint scheme.
   */
  async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.secretStorage = context.secrets;
    await this.migrateFromLegacyEndpoints();
  }

  // ── Per-provider API keys (REQ-CFG-013) ──────────────────────────────

  /**
   * Get the resolved API key for a provider. Checks SecretStorage first, then
   * falls back to the provider's environment variables (in catalog order).
   * Returns undefined if no key is available anywhere.
   */
  async getProviderApiKey(providerId: ProviderId): Promise<string | undefined> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized.');
    }
    const stored = await this.secretStorage.get(PROVIDER_KEY_PREFIX + providerId);
    if (stored) return stored;

    const provider = getProvider(providerId);
    if (!provider) return undefined;
    for (const envVar of provider.envVars) {
      const v = process.env[envVar];
      if (v && v.length > 0) return v;
    }
    return undefined;
  }

  /**
   * Where is this provider's key coming from? `stored` > `env` > `none`.
   */
  async getProviderKeySource(providerId: ProviderId): Promise<KeySource> {
    if (!this.secretStorage) return 'none';
    const stored = await this.secretStorage.get(PROVIDER_KEY_PREFIX + providerId);
    if (stored) return 'stored';
    const provider = getProvider(providerId);
    if (!provider) return 'none';
    for (const envVar of provider.envVars) {
      if (process.env[envVar]) return 'env';
    }
    return 'none';
  }

  /**
   * Which env var is currently supplying the key (if any)?
   */
  getProviderEnvVarInUse(providerId: ProviderId): string | undefined {
    const provider = getProvider(providerId);
    if (!provider) return undefined;
    for (const envVar of provider.envVars) {
      if (process.env[envVar]) return envVar;
    }
    return undefined;
  }

  /**
   * Store an API key for a provider. Takes precedence over any env var.
   */
  async setProviderApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('ConfigurationService not initialized.');
    }
    await this.secretStorage.store(PROVIDER_KEY_PREFIX + providerId, apiKey);
    this._onDidChangeProviders.fire();
  }

  /**
   * Remove a provider's stored API key. After removal the provider may still
   * be available via an env var.
   */
  async removeProviderApiKey(providerId: ProviderId): Promise<void> {
    if (!this.secretStorage) return;
    await this.secretStorage.delete(PROVIDER_KEY_PREFIX + providerId);
    await this.secretStorage.delete(PROVIDER_ENDPOINT_PREFIX + providerId);
    this._onDidChangeProviders.fire();
  }

  /** Get the endpoint URL for providers that require one (e.g. Azure). */
  async getProviderEndpointUrl(providerId: ProviderId): Promise<string | undefined> {
    if (!this.secretStorage) return undefined;
    const stored = await this.secretStorage.get(PROVIDER_ENDPOINT_PREFIX + providerId);
    if (stored) return stored;
    const provider = getProvider(providerId);
    if (provider?.endpointUrlEnvVar) {
      return process.env[provider.endpointUrlEnvVar];
    }
    return undefined;
  }

  async setProviderEndpointUrl(providerId: ProviderId, url: string): Promise<void> {
    if (!this.secretStorage) throw new Error('ConfigurationService not initialized.');
    await this.secretStorage.store(PROVIDER_ENDPOINT_PREFIX + providerId, url);
    this._onDidChangeProviders.fire();
  }

  /**
   * Return a masked API key suitable for display, or `(no key)` if none.
   */
  async getProviderApiKeyMasked(providerId: ProviderId): Promise<string> {
    const key = await this.getProviderApiKey(providerId);
    if (!key) return '(no key)';
    if (key.length <= 4) return '••••';
    return '••••••••' + key.slice(-4);
  }

  /**
   * REQ-CFG-013: List providers that have a usable key (stored or env var).
   */
  async getConfiguredProviders(): Promise<ProviderId[]> {
    const out: ProviderId[] = [];
    for (const provider of PROVIDERS) {
      const key = await this.getProviderApiKey(provider.id);
      if (key) out.push(provider.id);
    }
    return out;
  }

  /** Check whether a specific provider has any key available. */
  async isProviderConfigured(providerId: ProviderId): Promise<boolean> {
    const key = await this.getProviderApiKey(providerId);
    return !!key;
  }

  // ── Active model (REQ-CFG-013 AC-CFG-013-04) ────────────────────────

  /** Get the active `{providerId, modelId}` pair, if any. */
  getActiveModel(): ActiveModel | undefined {
    const stored = this.getConfig<ActiveModel | null>('activeModel', null);
    if (!stored || !stored.providerId || !stored.modelId) return undefined;
    return stored;
  }

  /** Set the active model. */
  async setActiveModel(model: ActiveModel): Promise<void> {
    await this.setConfig('activeModel', model);
    this._onDidChangeProviders.fire();
  }

  /** Clear the active model (no active selection). */
  async clearActiveModel(): Promise<void> {
    await this.setConfig('activeModel', null);
    this._onDidChangeProviders.fire();
  }

  // ── Strictness (REQ-AGT-013, REQ-AGT-014) ────────────────────────────

  getStrictnessSetting(): StrictnessLevel | '' {
    return this.getConfig<StrictnessLevel | ''>('agentStrictness', '');
  }

  async setStrictnessSetting(level: StrictnessLevel | ''): Promise<void> {
    await this.setConfig('agentStrictness', level);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    return config.get<T>(key, defaultValue);
  }

  private async setConfig<T>(key: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  // ── One-time migration from legacy multi-endpoint model (pre-0.2) ───

  /**
   * Migrate from the old `rqml.llmEndpoints[]` + `endpoint-key-{id}` scheme
   * to the new singleton-per-provider model. Runs once; idempotent.
   */
  private async migrateFromLegacyEndpoints(): Promise<void> {
    if (!this.secretStorage) return;
    const legacy = this.getConfig<LlmEndpoint[]>('llmEndpoints', []);
    if (!legacy || legacy.length === 0) return;

    const legacyActiveId = this.getConfig<string>('activeEndpointId', '');
    const legacyActive = legacy.find(e => e.id === legacyActiveId) || legacy[0];

    // For each unique provider in the legacy list, copy its key (first match)
    // to the new per-provider secret slot if not already set.
    const seen = new Set<ProviderId>();
    for (const ep of legacy) {
      const providerId = ep.provider as ProviderId;
      if (seen.has(providerId)) continue;
      seen.add(providerId);
      const existing = await this.secretStorage.get(PROVIDER_KEY_PREFIX + providerId);
      if (existing) continue;
      const oldKey = await this.secretStorage.get(`endpoint-key-${ep.id}`);
      if (oldKey) {
        await this.secretStorage.store(PROVIDER_KEY_PREFIX + providerId, oldKey);
      }
    }

    // Promote the active endpoint's model to the new activeModel setting
    if (legacyActive && legacyActive.model) {
      const current = this.getActiveModel();
      if (!current) {
        await this.setActiveModel({
          providerId: legacyActive.provider as ProviderId,
          modelId: legacyActive.model,
        });
      }
    }

    // Clean up legacy configs and their secret keys
    for (const ep of legacy) {
      await this.secretStorage.delete(`endpoint-key-${ep.id}`);
    }
    await this.setConfig('llmEndpoints', []);
    await this.setConfig('activeEndpointId', '');

    vscode.window.showInformationMessage(
      `RQML: Migrated ${seen.size} LLM provider key(s) to the new singleton-per-provider configuration.`
    );
    this._onDidChangeProviders.fire();
  }

  dispose(): void {
    this._onDidChangeConfiguration.dispose();
    this._onDidChangeProviders.dispose();
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
