// RQML VS Code Extension - Main Entry Point
// REQ-UI-001: Activity Bar icon
// REQ-UI-002: Open RQML overview
// REQ-UI-005: Tree view of specification
// REQ-UI-006: Selection details view
// REQ-UI-010: Status bar spec indicator
// REQ-UI-011: Offer spec creation
// REQ-AGT-001: Agent panel tab

import * as vscode from 'vscode';
import { RqmlTreeDataProvider } from './views/rqmlTreeProvider';
import { RqmlDetailsProvider } from './views/rqmlDetailsProvider';
import { RqmlTracesProvider } from './views/rqmlTracesProvider';
import { getSpecService, type SpecState } from './services/specService';
import { getDiagnosticsService } from './services/diagnosticsService';
import { getConfigurationService } from './services/configurationService';
import { getAgentService } from './services/agentService';
import { registerCommands } from './commands';
import { registerSettingsCommands } from './commands/settingsCommands';
import { registerAgentCommands } from './commands/agentCommands';
import { registerSlashPaletteCommands } from './commands/slashPaletteCommands';
import { AgentViewProvider } from './webviews/AgentViewProvider';

let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('RQML extension activating...');

  // Initialize services
  const specService = getSpecService();

  // REQ-CFG-001 through REQ-CFG-007: Initialize configuration service
  const configService = getConfigurationService();
  configService.initialize(context);
  context.subscriptions.push(configService);

  // REQ-UI-013A, REQ-UI-013B: Initialize diagnostics service for real-time validation
  const diagnosticsService = getDiagnosticsService();
  // Load the XSD schema into memory once
  await diagnosticsService.loadSchema(context.extensionPath);
  diagnosticsService.startWatching();
  context.subscriptions.push(diagnosticsService);

  // REQ-UI-005: Create tree view provider
  const treeProvider = new RqmlTreeDataProvider();

  // REQ-UI-006: Create details view provider
  const detailsProvider = new RqmlDetailsProvider();

  // REQ-UI-006J: Create traces view provider
  const tracesProvider = new RqmlTracesProvider();

  // Wire up tree selection to details and traces views
  treeProvider.onDidSelectNode((node) => {
    detailsProvider.setSelectedNode(node);
    tracesProvider.setSelectedNode(node);
  });

  // Wire up document changes to details and traces providers
  specService.onDidChangeSpec((state) => {
    detailsProvider.setDocument(state.document);
    tracesProvider.setDocument(state.document);
  });

  // Register tree view
  const treeView = vscode.window.createTreeView('rqmlTree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Register details view
  const detailsView = vscode.window.createTreeView('rqmlDetails', {
    treeDataProvider: detailsProvider
  });
  context.subscriptions.push(detailsView);

  // REQ-UI-006J: Register traces view
  const tracesView = vscode.window.createTreeView('rqmlTraces', {
    treeDataProvider: tracesProvider
  });
  context.subscriptions.push(tracesView);

  // Register commands (pass treeView for reveal functionality)
  registerCommands(context, treeProvider, treeView);

  // REQ-CFG-001: Register settings commands
  registerSettingsCommands(context);

  // REQ-CFG-008 through REQ-CFG-012: Register agent/endpoint commands
  registerAgentCommands(context);

  // REQ-AGT-001: Register RQML Agent panel (webview view in panel area)
  const agentService = getAgentService();
  agentService.initialize(context.extensionPath);
  context.subscriptions.push(agentService);

  const agentViewProvider = new AgentViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentViewProvider.viewType, agentViewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  context.subscriptions.push(agentViewProvider);

  // REQ-CMD-012: Register slash commands in Command Palette
  registerSlashPaletteCommands(context);

  // REQ-UI-010: Create status bar indicator
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'rqml-vscode.showSpecStatus';
  context.subscriptions.push(statusBarItem);

  // Register status command
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.showSpecStatus', () => {
      const state = specService.state;
      if (state.error) {
        vscode.window.showErrorMessage(`RQML: ${state.error}`);
      } else if (state.status === 'none') {
        vscode.window.showInformationMessage(
          'No RQML spec file found. Would you like to create one?',
          'Init Spec'
        ).then(selection => {
          if (selection === 'Init Spec') {
            vscode.commands.executeCommand('rqml-vscode.initSpec');
          }
        });
      } else if (state.document && state.xsdAvailable === false) {
        vscode.window.showWarningMessage(
          `RQML Spec loaded (v${state.document.version}), but schema rqml-${state.xsdVersion}.xsd not found. XSD validation is disabled.`
        );
      } else if (state.document) {
        vscode.window.showInformationMessage(
          `RQML Spec: ${state.document.docId} (v${state.document.version}, ${state.document.status})`
        );
      }
    })
  );

  // Initialize spec service with extension path for XSD resolution
  specService.initialize(context.extensionPath);

  // Update status bar on spec changes
  specService.onDidChangeSpec((state) => {
    updateStatusBar(state);
  });

  // Initial load
  const initialState = await specService.refresh();
  updateStatusBar(initialState);

  // REQ-UI-006J: Set initial document for trace lookup
  detailsProvider.setDocument(initialState.document);
  tracesProvider.setDocument(initialState.document);

  // REQ-UI-011: Offer spec creation if no file found
  if (initialState.status === 'none') {
    const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
    if (hasWorkspace) {
      const action = await vscode.window.showInformationMessage(
        'No RQML specification found in this workspace. Would you like to create one?',
        'Init Spec',
        'Later'
      );
      if (action === 'Init Spec') {
        await specService.initSpec();
      }
    }
  }

  // REQ-UI-012: Show error if multiple spec files
  if (initialState.status === 'multiple') {
    vscode.window.showErrorMessage(
      `Multiple RQML spec files found in workspace root. Please keep only one .rqml file.`
    );
  }

  // Clean up on deactivation
  context.subscriptions.push({
    dispose: () => {
      specService.dispose();
    }
  });

  console.log('RQML extension activated successfully');
}

/**
 * REQ-UI-010: Update status bar indicator
 * States: Spec invalid, Spec incomplete, Spec unimplemented, Spec synced
 */
function updateStatusBar(state: SpecState): void {
  switch (state.status) {
    case 'none':
      statusBarItem.text = '$(circle-slash) No RQML Spec';
      statusBarItem.tooltip = 'No RQML specification file found. Click to create one.';
      statusBarItem.backgroundColor = undefined;
      break;

    case 'multiple':
      statusBarItem.text = '$(error) RQML Error';
      statusBarItem.tooltip = state.error || 'Multiple RQML spec files found';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      break;

    case 'invalid':
      statusBarItem.text = '$(warning) Spec Invalid';
      statusBarItem.tooltip = state.error || 'RQML specification is invalid';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      break;

    case 'single':
      if (state.xsdAvailable === false) {
        statusBarItem.text = '$(warning) RQML Spec';
        statusBarItem.tooltip = `Schema rqml-${state.xsdVersion}.xsd not available. XSD validation disabled.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      } else {
        statusBarItem.text = '$(check) RQML Spec';
        statusBarItem.tooltip = 'RQML specification loaded. Click for details.';
        statusBarItem.backgroundColor = undefined;
      }
      break;
  }

  statusBarItem.show();
}

export function deactivate(): void {
  // Clean up handled by disposables
}
