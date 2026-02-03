// Trace Graph Webview Provider
// REQ-UI-006J: Visualize traceability as a graph

import * as vscode from 'vscode';
import { getSpecService } from '../services/specService';
import { transformToReactFlow } from '../transformers/rqmlToReactFlow';
import { getWebviewContent } from './shared/getWebviewContent';

export class TraceGraphViewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Show the Trace Graph panel
   */
  async show(): Promise<void> {
    const specService = getSpecService();
    const state = specService.state;

    if (!state.document) {
      vscode.window.showWarningMessage('No RQML specification loaded.');
      return;
    }

    // Create or reveal panel
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'rqmlTraceGraph',
        'RQML Trace Graph',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')]
        }
      );

      this.panel.webview.html = getWebviewContent(
        this.panel.webview,
        this.extensionUri,
        'trace-graph',
        'RQML Trace Graph'
      );

      // Handle messages from webview
      this.panel.webview.onDidReceiveMessage(
        this.handleMessage.bind(this),
        undefined,
        this.disposables
      );

      // Handle panel disposal
      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
          this.disposables.forEach((d) => d.dispose());
          this.disposables = [];
        },
        undefined,
        this.disposables
      );

      // Listen for document changes
      const subscription = specService.onDidChangeSpec((newState) => {
        if (newState.document && this.panel) {
          this.sendGraphData();
        }
      });
      this.disposables.push(subscription);
    }

    // Send initial data
    await this.sendGraphData();
  }

  /**
   * Send graph data to the webview
   */
  private async sendGraphData(): Promise<void> {
    if (!this.panel) return;

    const specService = getSpecService();
    const state = specService.state;

    if (!state.document) {
      this.panel.webview.postMessage({
        type: 'error',
        payload: 'No RQML specification loaded.'
      });
      return;
    }

    try {
      const data = transformToReactFlow(state.document);
      this.panel.webview.postMessage({
        type: 'setGraphData',
        payload: data
      });
    } catch (error) {
      this.panel.webview.postMessage({
        type: 'error',
        payload: `Error transforming trace data: ${error}`
      });
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
    switch (message.type) {
      case 'navigateToItem': {
        const payload = message.payload as { itemId: string };
        await this.navigateToItem(payload.itemId);
        break;
      }
      case 'requestRefresh':
        await this.sendGraphData();
        break;
    }
  }

  /**
   * Navigate to an item in the RQML file
   */
  private async navigateToItem(itemId: string): Promise<void> {
    const specService = getSpecService();
    const state = specService.state;

    if (!state.document) return;

    // Find the item's line number
    for (const section of state.document.sections.values()) {
      for (const item of section.items) {
        if (item.id === itemId && item.line) {
          const doc = await vscode.workspace.openTextDocument(state.document.uri);
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside
          });
          const position = new vscode.Position(item.line - 1, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
          );
          return;
        }

        // Check children
        if (item.children) {
          for (const child of item.children) {
            if (child.id === itemId && child.line) {
              const doc = await vscode.workspace.openTextDocument(state.document.uri);
              const editor = await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside
              });
              const position = new vscode.Position(child.line - 1, 0);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
              );
              return;
            }
          }
        }
      }
    }
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
