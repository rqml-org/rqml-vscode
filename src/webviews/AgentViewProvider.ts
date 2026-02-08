// REQ-AGT-001: Agent panel tab
// REQ-AGT-002: Prompt input
// REQ-AGT-004: RQML file change monitoring
// REQ-AGT-005: Codebase change monitoring
// REQ-AGT-008: User-confirmed modifications

import * as vscode from 'vscode';
import { getWebviewContent } from './shared/getWebviewContent';
import { getAgentService } from '../services/agentService';

/**
 * WebviewViewProvider for the RQML Agent panel tab.
 * Hosts the chat-style agent interface in the VS Code panel area.
 */
export class AgentViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rqmlAgent';

  private view: vscode.WebviewView | undefined;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

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
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')]
    };

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.extensionUri,
      'agent',
      'RQML AGENT'
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
        const { text } = message.payload as { text: string };
        await agentService.handleUserMessage(text);
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
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
