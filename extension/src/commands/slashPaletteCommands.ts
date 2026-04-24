// REQ-CMD-012: Command Palette access to slash commands
// Registers VS Code commands that dispatch to slash command handlers.
// When invoked from the palette, the agent panel is focused and output appears there.

import * as vscode from 'vscode';
import { getAgentService } from '../services/agentService';
import { getModelCatalogService } from '../services/modelCatalogService';
import { getConfigurationService } from '../services/configurationService';

/**
 * Map of palette command ID → slash command string to dispatch.
 * Only commands that make sense as standalone palette actions are included.
 */
const PALETTE_COMMANDS: Array<{ id: string; slash: string }> = [
  { id: 'rqml-vscode.slashHelp',       slash: '/help' },
  { id: 'rqml-vscode.slashStatus',     slash: '/status' },
  { id: 'rqml-vscode.slashStatusFull', slash: '/status --full' },
  { id: 'rqml-vscode.slashValidate',   slash: '/validate' },
  { id: 'rqml-vscode.slashLint',       slash: '/lint' },
  { id: 'rqml-vscode.slashScore',      slash: '/score' },
  { id: 'rqml-vscode.slashSync',       slash: '/sync' },
  { id: 'rqml-vscode.slashSyncScan',   slash: '/sync scan' },
  { id: 'rqml-vscode.slashPlan',       slash: '/plan' },
  { id: 'rqml-vscode.slashProviders',  slash: '/providers' },
  { id: 'rqml-vscode.slashLlm',        slash: '/llm' },
  { id: 'rqml-vscode.slashDoctor',     slash: '/doctor' },
  { id: 'rqml-vscode.slashAbout',      slash: '/about' },
  { id: 'rqml-vscode.slashModels',     slash: '/models' },
  { id: 'rqml-vscode.slashModelTest',  slash: '/model test' },
  { id: 'rqml-vscode.slashImplement', slash: '/implement' },
  { id: 'rqml-vscode.slashElicit', slash: '/elicit' },
];

/**
 * Register all palette commands that dispatch to slash command handlers.
 */
export function registerSlashPaletteCommands(context: vscode.ExtensionContext): void {
  for (const { id, slash } of PALETTE_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async () => {
        // Focus the agent view so the user sees the output
        await vscode.commands.executeCommand('rqmlAgentView.focus');

        // Dispatch through the agent service
        const agentService = getAgentService();
        await agentService.handleUserMessage(slash);
      })
    );
  }

  // Note: "RQML: Select Model" is registered in agentCommands.ts (singleton-per-provider architecture).
}
