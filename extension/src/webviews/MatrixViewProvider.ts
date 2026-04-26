// REQ-MAT-001: Traceability Matrix Webview Provider — opens as a tab in the
// main editor area with a title that includes the active RQML file name.

import * as vscode from 'vscode';
import * as path from 'path';
import { getSpecService } from '../services/specService';
import { transformToMatrix } from '../transformers/rqmlToMatrix';
import { getWebviewContent } from './shared/getWebviewContent';

export class MatrixViewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Show the Traceability Matrix panel.
   */
  async show(): Promise<void> {
    const specService = getSpecService();
    const state = specService.state;

    if (!state.document) {
      vscode.window.showWarningMessage('No RQML specification loaded.');
      return;
    }

    const fileName = path.basename(state.document.uri.fsPath);
    const title = `Traceability Matrix — ${fileName}`;

    // Create or reveal panel
    if (this.panel) {
      this.panel.title = title;
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'rqmlMatrix',
        title,
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
        'matrix',
        title,
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

      // Listen for document changes — refresh data and update tab title.
      const subscription = specService.onDidChangeSpec((newState) => {
        if (newState.document && this.panel) {
          const newName = path.basename(newState.document.uri.fsPath);
          this.panel.title = `Traceability Matrix — ${newName}`;
          this.sendMatrixData();
        }
      });
      this.disposables.push(subscription);
    }

    // Send initial data
    await this.sendMatrixData();
  }

  /**
   * Send matrix data to the webview
   */
  private async sendMatrixData(): Promise<void> {
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

    const fileName = path.basename(state.document.uri.fsPath);
    const parseError = state.status === 'invalid' ? state.error : undefined;

    try {
      const data = transformToMatrix(state.document, fileName, parseError);
      this.panel.webview.postMessage({
        type: 'setMatrixData',
        payload: data
      });
    } catch (error) {
      this.panel.webview.postMessage({
        type: 'error',
        payload: `Error transforming matrix data: ${error}`
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
        await this.sendMatrixData();
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
