// REQ-CFG-008 through REQ-CFG-012: LLM endpoint management commands

import * as vscode from 'vscode';
import { getConfigurationService } from '../services/configurationService';
import type { LlmEndpoint } from '../types/configuration';

const PROVIDER_LABELS: Record<LlmEndpoint['provider'], string> = {
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'azure-openai': 'Azure OpenAI',
  'google': 'Google AI',
};

/**
 * Register agent-related commands (endpoint management)
 */
export function registerAgentCommands(context: vscode.ExtensionContext): void {
  const configService = getConfigurationService();

  // REQ-CFG-012: Add LLM endpoint
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.addLlmEndpoint', async () => {
      // Step 1: Select provider
      const providerItems = Object.entries(PROVIDER_LABELS).map(([id, label]) => ({
        id: id as LlmEndpoint['provider'],
        label,
      }));

      const selectedProvider = await vscode.window.showQuickPick(providerItems, {
        placeHolder: 'Select LLM provider',
        title: 'Add LLM Endpoint'
      });
      if (!selectedProvider) return;

      // Step 2: Enter display name
      const name = await vscode.window.showInputBox({
        prompt: 'Enter a display name for this endpoint',
        value: selectedProvider.label,
        validateInput: v => v.trim() ? null : 'Name is required',
      });
      if (!name) return;

      // Step 3: Enter model (optional)
      const defaultModels: Record<LlmEndpoint['provider'], string> = {
        'openai': 'gpt-4o',
        'anthropic': 'claude-sonnet-4-5-20250929',
        'azure-openai': 'gpt-4o',
        'google': 'gemini-2.0-flash',
      };

      const model = await vscode.window.showInputBox({
        prompt: 'Enter model identifier (leave blank for default)',
        value: defaultModels[selectedProvider.id],
      });
      if (model === undefined) return; // cancelled

      // Step 4: Enter API key
      const apiKey = await vscode.window.showInputBox({
        prompt: `Enter your ${selectedProvider.label} API key`,
        password: true,
        placeHolder: 'sk-...',
        ignoreFocusOut: true,
        validateInput: v => v.trim() ? null : 'API key is required',
      });
      if (!apiKey) return;

      // Create the endpoint
      const endpoint: LlmEndpoint = {
        id: `${selectedProvider.id}-${Date.now()}`,
        provider: selectedProvider.id,
        name: name.trim(),
        model: model.trim() || undefined,
      };

      await configService.addEndpoint(endpoint, apiKey.trim());

      // If no active endpoint, set this one
      if (!configService.getActiveEndpointId()) {
        await configService.setActiveEndpointId(endpoint.id);
      }

      vscode.window.showInformationMessage(
        `LLM endpoint "${endpoint.name}" added. API key stored securely.`
      );
    })
  );

  // REQ-CFG-011: Remove LLM endpoint
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.removeLlmEndpoint', async () => {
      const endpoints = configService.getEndpoints();

      if (endpoints.length === 0) {
        vscode.window.showInformationMessage('No LLM endpoints configured.');
        return;
      }

      const activeId = configService.getActiveEndpointId();

      const items = await Promise.all(endpoints.map(async (ep) => {
        const masked = await configService.getEndpointApiKeyMasked(ep.id);
        return {
          id: ep.id,
          label: ep.name,
          description: `${PROVIDER_LABELS[ep.provider]}${ep.id === activeId ? ' (active)' : ''}`,
          detail: `Key: ${masked}${ep.model ? ` | Model: ${ep.model}` : ''}`,
        };
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select endpoint to remove',
        title: 'Remove LLM Endpoint'
      });
      if (!selected) return;

      const confirm = await vscode.window.showWarningMessage(
        `Remove endpoint "${selected.label}"? The associated API key will be deleted.`,
        { modal: true },
        'Remove'
      );
      if (confirm !== 'Remove') return;

      await configService.removeEndpoint(selected.id);
      vscode.window.showInformationMessage(`Endpoint "${selected.label}" removed.`);
    })
  );

  // REQ-CFG-010: Select active endpoint (list with radio-style selection)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.selectActiveEndpoint', async () => {
      const endpoints = configService.getEndpoints();

      if (endpoints.length === 0) {
        const action = await vscode.window.showInformationMessage(
          'No LLM endpoints configured. Would you like to add one?',
          'Add Endpoint',
          'Cancel'
        );
        if (action === 'Add Endpoint') {
          await vscode.commands.executeCommand('rqml-vscode.addLlmEndpoint');
        }
        return;
      }

      const activeId = configService.getActiveEndpointId();

      const items = endpoints.map(ep => ({
        id: ep.id,
        label: `${ep.id === activeId ? '$(check) ' : '     '}${ep.name}`,
        description: `${PROVIDER_LABELS[ep.provider]}${ep.model ? ` (${ep.model})` : ''}`,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select the active LLM endpoint for the RQML Agent',
        title: 'Select Active Endpoint'
      });
      if (!selected) return;

      await configService.setActiveEndpointId(selected.id);
      vscode.window.showInformationMessage(`Active endpoint set to "${selected.label.trim()}".`);
    })
  );
}
