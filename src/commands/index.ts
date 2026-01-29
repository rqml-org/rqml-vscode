// Command implementations for the RQML VS Code extension
// REQ-UI-006E: Context menu actions (rename, delete)
// REQ-UI-006F: Go to definition

import * as vscode from 'vscode';
import { TreeNode, RqmlTreeDataProvider } from '../views/rqmlTreeProvider';
import { getSpecService } from '../services/specService';

/**
 * Register all commands for the extension.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  treeProvider: RqmlTreeDataProvider
): void {
  // REQ-UI-011: Create spec command
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.createSpec', async () => {
      const specService = getSpecService();
      await specService.createSpec();
    })
  );

  // Select tree node (internal command for details view update)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.selectTreeNode', (node: TreeNode) => {
      treeProvider.selectNode(node);
    })
  );

  // REQ-UI-006F: Go to definition
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.gotoDefinition', async (node: TreeNode) => {
      if (!node.item?.line) {
        vscode.window.showInformationMessage('No source location available for this item.');
        return;
      }

      const specService = getSpecService();
      const state = specService.state;

      if (!state.document?.uri) {
        vscode.window.showErrorMessage('No RQML document loaded.');
        return;
      }

      const doc = await vscode.workspace.openTextDocument(state.document.uri);
      const editor = await vscode.window.showTextDocument(doc);

      // Go to the line (1-indexed to 0-indexed)
      const line = node.item.line - 1;
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    })
  );

  // REQ-UI-006E: Rename item
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.renameItem', async (node: TreeNode) => {
      if (!node.item) {
        vscode.window.showInformationMessage('Cannot rename this item.');
        return;
      }

      const currentTitle = node.item.title || node.item.name || node.item.id;

      const newTitle = await vscode.window.showInputBox({
        prompt: 'Enter new title',
        value: currentTitle,
        validateInput: (value) => {
          if (!value.trim()) return 'Title cannot be empty';
          return null;
        }
      });

      if (!newTitle || newTitle === currentTitle) return;

      // TODO: Implement actual XML editing
      // For now, show message about manual editing
      vscode.window.showInformationMessage(
        `Rename functionality coming soon. Please edit the title attribute manually in the RQML file.`
      );

      // Open the file at the item's location
      await vscode.commands.executeCommand('rqml-vscode.gotoDefinition', node);
    })
  );

  // REQ-UI-006E: Delete item
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.deleteItem', async (node: TreeNode) => {
      if (!node.item) {
        vscode.window.showInformationMessage('Cannot delete this item.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Delete "${node.item.title || node.item.id}"?`,
        { modal: true },
        'Delete'
      );

      if (confirm !== 'Delete') return;

      // TODO: Implement actual XML editing
      vscode.window.showInformationMessage(
        `Delete functionality coming soon. Please remove the item manually from the RQML file.`
      );

      // Open the file at the item's location
      await vscode.commands.executeCommand('rqml-vscode.gotoDefinition', node);
    })
  );

  // REQ-UI-006C: Add item to section
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.addItem', async (node: TreeNode) => {
      if (node.type !== 'section') {
        vscode.window.showInformationMessage('Select a section to add items.');
        return;
      }

      // TODO: Implement item creation with proper XML editing
      vscode.window.showInformationMessage(
        `Add item functionality coming soon. Please add items manually to the RQML file.`
      );

      // Open the spec file
      const specService = getSpecService();
      const state = specService.state;
      if (state.document?.uri) {
        const doc = await vscode.workspace.openTextDocument(state.document.uri);
        await vscode.window.showTextDocument(doc);
      }
    })
  );

  // REQ-UI-006I: Open document view (placeholder)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openDocumentView', () => {
      vscode.window.showInformationMessage('WYSIWYG document view coming soon.');
    })
  );

  // REQ-UI-006I: Open trace view (placeholder)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openTraceView', () => {
      vscode.window.showInformationMessage('Traceability map view coming soon.');
    })
  );

  // REQ-UI-006I: Open grid view (placeholder)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openGridView', () => {
      vscode.window.showInformationMessage('Requirements grid view coming soon.');
    })
  );

  // REQ-UI-006I: Open ideas view (placeholder)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openIdeasView', () => {
      vscode.window.showInformationMessage('LLM-assisted ideas view coming soon.');
    })
  );

  // REQ-EXP-005: Export functionality
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.export', async () => {
      const format = await vscode.window.showQuickPick(
        [
          { label: 'HTML', description: 'Export as HTML document (free)', format: 'html' },
          { label: 'PDF', description: 'Export as PDF document (pro)', format: 'pdf' },
          { label: 'Markdown', description: 'Export as Markdown document (pro)', format: 'markdown' },
          { label: 'Word', description: 'Export as Word document (pro)', format: 'docx' }
        ],
        {
          placeHolder: 'Select export format'
        }
      );

      if (!format) return;

      if (format.format !== 'html') {
        // REQ-SUB-002: Feature gating for pro features
        vscode.window.showInformationMessage(
          `${format.label} export requires a Pro subscription. HTML export is available for free.`
        );
        return;
      }

      // HTML export is available
      vscode.window.showInformationMessage('HTML export functionality coming soon.');
    })
  );
}
