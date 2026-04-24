// REQ-CFG-013: Provider singleton management commands
// REQ-CFG-014: Environment variable auto-detection

import * as vscode from 'vscode';
import { getConfigurationService } from '../services/configurationService';
import { getModelCatalogService } from '../services/modelCatalogService';
import { PROVIDERS, getProvider } from '../models/catalog';
import type { ProviderId } from '../types/configuration';

/**
 * Register provider/model management commands.
 *
 * REQ-CFG-013: Providers are singletons (one per provider type).
 * REQ-CFG-014: API keys may come from env vars or VS Code SecretStorage.
 */
export function registerAgentCommands(context: vscode.ExtensionContext): void {
  const configService = getConfigurationService();
  const catalogService = getModelCatalogService();

  // ── RQML: Add LLM Provider ────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.addLlmProvider', async () => {
      // Step 1: Pick a provider from the curated catalog, annotated with
      // current key source (env/stored) to make the choice informed.
      const items = await Promise.all(PROVIDERS.map(async (p) => {
        const source = await configService.getProviderKeySource(p.id);
        const envVar = configService.getProviderEnvVarInUse(p.id);
        const description =
          source === 'stored'
            ? '$(check) Key stored'
            : source === 'env'
              ? `$(check) Using $${envVar}`
              : `Not configured · env: ${p.envVars.join(', ')}`;
        return {
          id: p.id,
          label: p.displayName,
          description,
          source,
          envVar,
        };
      }));

      const selected = await vscode.window.showQuickPick(items, {
        title: 'Add LLM Provider',
        placeHolder: 'Choose a provider',
      });
      if (!selected) return;

      const provider = getProvider(selected.id);
      if (!provider) return;

      // Step 2a: If env var is already supplying a key, offer to use it
      // as-is (no stored secret required) or override.
      let apiKey: string | undefined;
      if (selected.source === 'env' && selected.envVar) {
        const action = await vscode.window.showInformationMessage(
          `${provider.displayName}: key found in $${selected.envVar}. Use it?`,
          'Use environment variable',
          'Enter a different key',
        );
        if (action === 'Use environment variable') {
          // Nothing to store — the env var is read on each use.
          // Only job left: set the active model default if none set.
          await ensureActiveModelForProvider(provider.id);
          vscode.window.showInformationMessage(
            `${provider.displayName} is ready. Using $${selected.envVar}.`
          );
          return;
        }
        if (action !== 'Enter a different key') return;
      }

      // Step 2b: Prompt for API key.
      apiKey = await vscode.window.showInputBox({
        title: `${provider.displayName} — API key`,
        prompt: provider.docsUrl
          ? `Enter your API key (get one at ${provider.docsUrl})`
          : 'Enter your API key',
        password: true,
        placeHolder: provider.keyPlaceholder,
        ignoreFocusOut: true,
        validateInput: v => v.trim() ? null : 'API key is required',
      });
      if (!apiKey) return;

      // Step 3: Azure needs an endpoint URL or resource name.
      if (provider.requiresEndpointUrl) {
        const envHint = provider.endpointUrlEnvVar ? ` (or set $${provider.endpointUrlEnvVar})` : '';
        const existing = await configService.getProviderEndpointUrl(provider.id);
        const endpointUrl = await vscode.window.showInputBox({
          title: `${provider.displayName} — Resource name or base URL`,
          prompt: `Enter the Azure resource name or full base URL${envHint}`,
          value: existing,
          ignoreFocusOut: true,
          validateInput: v => v.trim() ? null : 'Endpoint is required for this provider',
        });
        if (!endpointUrl) return;
        await configService.setProviderEndpointUrl(provider.id, endpointUrl.trim());
      }

      await configService.setProviderApiKey(provider.id, apiKey.trim());
      await ensureActiveModelForProvider(provider.id);

      vscode.window.showInformationMessage(
        `${provider.displayName} configured. API key stored securely.`
      );
    })
  );

  // ── RQML: Remove LLM Provider ─────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.removeLlmProvider', async () => {
      const configured = await configService.getConfiguredProviders();
      if (configured.length === 0) {
        vscode.window.showInformationMessage('No LLM providers are configured.');
        return;
      }

      const items = await Promise.all(configured.map(async (id) => {
        const p = getProvider(id)!;
        const source = await configService.getProviderKeySource(id);
        const masked = await configService.getProviderApiKeyMasked(id);
        return {
          id,
          label: p.displayName,
          description: source === 'env' ? `$(info) Using env var (cannot remove)` : `Key: ${masked}`,
          source,
        };
      }));

      const selected = await vscode.window.showQuickPick(items, {
        title: 'Remove LLM Provider',
        placeHolder: 'Choose a provider to remove',
      });
      if (!selected) return;

      if (selected.source === 'env') {
        vscode.window.showInformationMessage(
          `${selected.label} is configured via an environment variable. Unset the env var to remove it.`
        );
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove stored key for "${selected.label}"?`,
        { modal: true },
        'Remove',
      );
      if (confirm !== 'Remove') return;

      await configService.removeProviderApiKey(selected.id);

      // If the active model belonged to this provider, clear it.
      const active = configService.getActiveModel();
      if (active && active.providerId === selected.id) {
        await configService.clearActiveModel();
      }

      vscode.window.showInformationMessage(`${selected.label} removed.`);
    })
  );

  // ── RQML: Select Model ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.selectModel', async () => {
      await catalogService.showModelPicker();
    })
  );
}

/**
 * If no active model is set, pick the recommended model for this provider
 * and make it active. Otherwise leave the current selection alone.
 */
async function ensureActiveModelForProvider(providerId: ProviderId): Promise<void> {
  const config = getConfigurationService();
  const current = config.getActiveModel();
  if (current) return;

  const catalog = getModelCatalogService();
  const recommended = catalog.getRecommendedModel(providerId);
  if (recommended) {
    await config.setActiveModel({
      providerId,
      modelId: recommended.modelId,
    });
  }
}
