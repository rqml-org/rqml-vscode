// REQ-CFG-001: Settings UI commands
// REQ-CFG-002: API key management commands
// REQ-CFG-004: LLM provider selection

import * as vscode from 'vscode';
import { getConfigurationService } from '../services/configurationService';
import { LlmProvider } from '../types/configuration';

const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  'none': 'None (LLM features disabled)',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic (Claude)',
  'azure-openai': 'Azure OpenAI',
  'ollama': 'Ollama (Local)'
};

/**
 * Register all settings-related commands
 */
export function registerSettingsCommands(context: vscode.ExtensionContext): void {
  const configService = getConfigurationService();

  // REQ-CFG-001: Open RQML settings
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Stakkar.rqml-vscode');
    })
  );

  // REQ-CFG-002, REQ-CFG-003: Configure API key
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.configureApiKey', async () => {
      const provider = configService.getLlmProvider();

      if (provider === 'none') {
        const action = await vscode.window.showInformationMessage(
          'No LLM provider selected. Would you like to select one first?',
          'Select Provider',
          'Cancel'
        );
        if (action === 'Select Provider') {
          await vscode.commands.executeCommand('rqml-vscode.selectLlmProvider');
        }
        return;
      }

      const secretKey = configService.getSecretKeyForProvider(provider);
      if (!secretKey) {
        vscode.window.showInformationMessage(`${LLM_PROVIDER_LABELS[provider]} does not require an API key.`);
        return;
      }

      const hasKey = await configService.hasApiKey(secretKey);

      const apiKey = await vscode.window.showInputBox({
        prompt: `Enter your ${LLM_PROVIDER_LABELS[provider]} API key`,
        password: true,
        placeHolder: hasKey ? '(key already stored - enter new key to replace)' : 'sk-...',
        ignoreFocusOut: true
      });

      if (apiKey === undefined) {
        return; // Cancelled
      }

      if (apiKey === '') {
        // Empty string means delete
        const confirm = await vscode.window.showWarningMessage(
          `Delete stored ${LLM_PROVIDER_LABELS[provider]} API key?`,
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          await configService.deleteApiKey(secretKey);
          vscode.window.showInformationMessage('API key deleted.');
        }
      } else {
        await configService.setApiKey(secretKey, apiKey);
        vscode.window.showInformationMessage(`${LLM_PROVIDER_LABELS[provider]} API key stored securely.`);
      }
    })
  );

  // REQ-CFG-004: Select LLM provider
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.selectLlmProvider', async () => {
      const currentProvider = configService.getLlmProvider();

      const items = Object.entries(LLM_PROVIDER_LABELS).map(([id, label]) => ({
        id: id as LlmProvider,
        label,
        description: id === currentProvider ? '(current)' : undefined
      }));

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select LLM provider for AI-assisted features',
        title: 'RQML: Select LLM Provider'
      });

      if (selection) {
        await configService.setLlmProvider(selection.id);

        // Prompt for API key if needed
        const secretKey = configService.getSecretKeyForProvider(selection.id);
        if (secretKey) {
          const hasKey = await configService.hasApiKey(secretKey);
          if (!hasKey) {
            const action = await vscode.window.showInformationMessage(
              `${selection.label} requires an API key. Would you like to configure it now?`,
              'Configure API Key',
              'Later'
            );
            if (action === 'Configure API Key') {
              await vscode.commands.executeCommand('rqml-vscode.configureApiKey');
            }
          }
        }
      }
    })
  );

}
