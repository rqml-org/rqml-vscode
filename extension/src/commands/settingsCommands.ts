// REQ-CFG-001: Settings UI commands

import * as vscode from 'vscode';

/**
 * Register general settings-related commands.
 *
 * Provider and API-key configuration now lives in the singleton-per-provider
 * commands (`rqml-vscode.addLlmProvider`, `rqml-vscode.removeLlmProvider`) —
 * see agentCommands.ts.
 */
export function registerSettingsCommands(context: vscode.ExtensionContext): void {
  // REQ-CFG-001: Open RQML settings
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:rqml.rqml-vscode');
    })
  );

  // Backwards-compat alias — older keybindings or docs may still reference this.
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.configureApiKey', async () => {
      await vscode.commands.executeCommand('rqml-vscode.addLlmProvider');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.selectLlmProvider', async () => {
      await vscode.commands.executeCommand('rqml-vscode.addLlmProvider');
    })
  );
}
