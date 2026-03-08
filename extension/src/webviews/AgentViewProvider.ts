// REQ-AGT-001: Agent panel tab
// REQ-AGT-002: Prompt input
// REQ-AGT-004: RQML file change monitoring
// REQ-AGT-005: Codebase change monitoring
// REQ-AGT-008: User-confirmed modifications

import * as vscode from 'vscode';
import { getWebviewContent } from './shared/getWebviewContent';
import { getAgentService } from '../services/agentService';
import { getSpecService } from '../services/specService';
import { getModelCatalogService } from '../services/modelCatalogService';
import { getConfigurationService } from '../services/configurationService';

/**
 * WebviewViewProvider for the RQML Agent panel tab.
 * Hosts the chat-style agent interface in the sidebar.
 */
export class AgentViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rqmlAgentView';

  private view: vscode.WebviewView | undefined;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private terminal: vscode.Terminal | undefined;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'resources'),
      ]
    };

    const logoUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'RQML_logo_transparent.png')
    );
    const rqmlIconUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'rqml.png')
    );

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.extensionUri,
      'agent',
      'RQML AGENT',
      { logoUri: logoUri.toString(), rqmlIconUri: rqmlIconUri.toString() }
    );

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      this.handleMessage.bind(this),
      undefined,
      this.disposables
    );

    // Listen for agent service messages
    const agentService = getAgentService();
    this.disposables.push(
      agentService.onDidReceiveMessage((msg) => {
        this.postToWebview(msg);
      })
    );

    webviewView.onDidDispose(() => {
      this.disposables.forEach(d => d.dispose());
      this.disposables = [];
      this.view = undefined;
    });
  }

  /**
   * Post a message to the agent webview
   */
  postToWebview(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  private async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
    const agentService = getAgentService();

    switch (message.type) {
      case 'sendPrompt': {
        // REQ-AGT-002: User submitted a prompt
        const { text, images } = message.payload as {
          text: string;
          images?: Array<{ dataUrl: string; mediaType: string }>;
        };
        await agentService.handleUserMessage(text, images);
        break;
      }
      case 'acceptChange': {
        // REQ-AGT-008: User accepted a proposed change
        const { changeId } = message.payload as { changeId: string };
        await agentService.applyChange(changeId);
        break;
      }
      case 'rejectChange': {
        // REQ-AGT-008: User rejected a proposed change
        const { changeId } = message.payload as { changeId: string };
        agentService.rejectChange(changeId);
        break;
      }
      case 'allowAllChanges': {
        // REQ-AGT-008 AC-AGT-008-04: Allow all for remainder of session
        agentService.setAutoApprove(true);
        break;
      }
      case 'requestEndpoints': {
        // Send current endpoint configuration to webview
        await agentService.sendEndpointStatus();
        break;
      }
      case 'requestStartupStatus': {
        const status = await agentService.getStartupStatus();
        this.postToWebview({ type: 'startupStatus', payload: status });
        break;
      }
      case 'requestCommandList': {
        // REQ-CMD-002: Send command names to webview for autocomplete
        const names = agentService.commandRegistry.getAllNames();
        this.postToWebview({ type: 'commandList', payload: { names } });
        break;
      }
      case 'navigateToRequirement': {
        // REQ-CMD-003: Navigate to a requirement ID in the spec file
        const { id } = message.payload as { id: string };
        await this.navigateToRequirement(id);
        break;
      }
      case 'copyToClipboard': {
        const { content } = message.payload as { content: string };
        await vscode.env.clipboard.writeText(content);
        vscode.window.setStatusBarMessage('Copied to clipboard.', 3000);
        break;
      }
      case 'approveToolCall': {
        const { approvalId } = message.payload as { approvalId: string };
        agentService.resolveToolApproval(approvalId, true);
        break;
      }
      case 'rejectToolCall': {
        const { approvalId } = message.payload as { approvalId: string };
        agentService.resolveToolApproval(approvalId, false);
        break;
      }
      case 'allowAllToolCalls': {
        const { approvalId } = message.payload as { approvalId: string };
        agentService.setAutoApproveTools(true);
        agentService.resolveToolApproval(approvalId, true);
        break;
      }
      case 'respondToChoice': {
        const { choiceId, selected } = message.payload as { choiceId: string; selected: string };
        agentService.resolveUserChoice(choiceId, selected);
        break;
      }
      case 'requestModelList': {
        await this.sendModelList();
        break;
      }
      case 'selectModel': {
        const { modelId } = message.payload as { modelId: string };
        await this.handleSelectModel(modelId);
        break;
      }
      case 'runInTerminal': {
        const { command } = message.payload as { command: string };
        this.runInTerminal(command);
        break;
      }
    }
  }

  /**
   * Send available models and current selection to the webview.
   */
  private async sendModelList(): Promise<void> {
    const catalogService = getModelCatalogService();
    const configService = getConfigurationService();
    const endpoint = configService.getActiveEndpoint();

    const catalog = await catalogService.getAvailableCatalog();
    const models = catalog.map(e => ({
      modelId: e.modelId,
      displayName: e.displayName,
      provider: e.provider,
    }));

    const selectedModel = endpoint
      ? catalogService.getSelectedModelId(endpoint)
      : undefined;

    this.postToWebview({
      type: 'modelList',
      payload: { models, selectedModel },
    });
  }

  /**
   * Handle model selection from the webview dropdown.
   */
  private async handleSelectModel(modelId: string): Promise<void> {
    const catalogService = getModelCatalogService();
    const configService = getConfigurationService();
    const endpoint = configService.getActiveEndpoint();
    if (!endpoint) return;

    const entry = catalogService.findModel(modelId);
    if (!entry) return;

    await catalogService.selectModelEntry(entry, endpoint);
    // Refresh endpoint status so the UI updates
    await getAgentService().sendEndpointStatus();
    // Refresh model list (endpoint may have changed)
    await this.sendModelList();
  }

  /**
   * Run a command in the VS Code integrated terminal.
   * Reuses an existing RQML terminal if still open.
   */
  private runInTerminal(command: string): void {
    // Check if existing terminal is still alive
    if (this.terminal && this.terminal.exitStatus === undefined) {
      this.terminal.show(true);
      this.terminal.sendText(command);
    } else {
      this.terminal = vscode.window.createTerminal({ name: 'RQML' });
      this.terminal.show(true);
      this.terminal.sendText(command);
    }
  }

  /**
   * REQ-CMD-003: Navigate to a requirement by ID in the spec file
   */
  private async navigateToRequirement(id: string): Promise<void> {
    const specService = getSpecService();
    const state = specService.state;
    if (!state.document?.uri) return;

    // Find the line number for this ID by searching the document text
    try {
      const textDoc = await vscode.workspace.openTextDocument(state.document.uri);
      const text = textDoc.getText();
      // Search for id="<id>" pattern in the XML
      const pattern = new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`);
      const match = pattern.exec(text);

      if (match) {
        const pos = textDoc.positionAt(match.index);
        const range = new vscode.Range(pos, pos);
        await vscode.window.showTextDocument(textDoc, {
          selection: range,
          preserveFocus: false,
        });
      } else {
        // Fallback: just open the file
        await vscode.window.showTextDocument(textDoc);
      }
    } catch {
      // Silently fail if we can't navigate
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
