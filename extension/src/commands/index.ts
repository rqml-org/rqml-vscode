// Command implementations for the RQML VS Code extension
// REQ-UI-006E: Context menu actions (rename, delete)
// REQ-UI-006F: Go to definition
// REQ-UI-006K: Clickable trace IDs
// REQ-UI-006L: Synchronized view updates

import * as vscode from 'vscode';
import { TreeNode, RqmlTreeDataProvider } from '../views/rqmlTreeProvider';
import { getSpecService } from '../services/specService';
import { DocumentViewProvider } from '../webviews/DocumentViewProvider';
import { TraceGraphViewProvider } from '../webviews/TraceGraphViewProvider';
import { MatrixViewProvider } from '../webviews/MatrixViewProvider';
import { ExportViewProvider } from '../webviews/ExportViewProvider';
import { loadCore } from '../services/core';
import { writeSpecGuarded } from '../services/specWrite';
import {
  deleteElement,
  insertIntoSection,
  renameElement,
  type TextEditResult,
} from '../services/spec/textEdit';

// Webview providers (initialized during registration)
let documentViewProvider: DocumentViewProvider | undefined;
let traceGraphViewProvider: TraceGraphViewProvider | undefined;
let matrixViewProvider: MatrixViewProvider | undefined;
let exportViewProvider: ExportViewProvider | undefined;

/**
 * Apply a targeted text edit to the active specification.
 *
 * REQ-UI-006C/006E. The tree's edit commands were "coming soon" messages that
 * told the user to edit the XML by hand. They now perform the edit, and every
 * one goes through the same guard the agent's writes do: the result is
 * re-parsed, re-validated and integrity-checked, and a change that would
 * introduce an error is refused rather than written.
 *
 * The edit is textual rather than parse → modify → serialize because
 * serialising reflows the document and drops its XML comments — a rename must
 * not silently delete a user's commentary.
 */
async function applySpecEdit(
  edit: (xml: string) => TextEditResult,
  description: string,
  note?: string
): Promise<void> {
  const uri = getSpecService().state.activeSpecUri;
  if (!uri) {
    vscode.window.showWarningMessage('RQML: no active specification.');
    return;
  }

  const xml = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  const result = edit(xml);
  if (!result.ok) {
    vscode.window.showErrorMessage(`RQML: ${result.error}`);
    return;
  }

  const written = await writeSpecGuarded(uri, result.xml, description);
  if (!written.ok) {
    // The refusal explains which errors the edit would have introduced, which
    // is more useful than "the edit failed".
    vscode.window.showErrorMessage(`RQML: ${written.reason.split('\n')[0]}`, 'Show Details').then(
      (choice) => {
        if (choice === 'Show Details') {
          vscode.window.showInformationMessage(written.reason, { modal: true });
        }
      }
    );
    return;
  }

  await getSpecService().refresh();
  vscode.window.showInformationMessage(
    note ? `RQML: ${description}. ${note}` : `RQML: ${description}.`
  );
}

/**
 * Register all commands for the extension.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  treeProvider: RqmlTreeDataProvider,
  treeView: vscode.TreeView<TreeNode>
): void {
  // Initialize webview providers
  documentViewProvider = new DocumentViewProvider(context.extensionUri);
  traceGraphViewProvider = new TraceGraphViewProvider(context.extensionUri);
  matrixViewProvider = new MatrixViewProvider(context.extensionUri);
  exportViewProvider = new ExportViewProvider(context.extensionUri);

  // Add providers to subscriptions for cleanup
  context.subscriptions.push({
    dispose: () => {
      documentViewProvider?.dispose();
      traceGraphViewProvider?.dispose();
      matrixViewProvider?.dispose();
      exportViewProvider?.dispose();
    }
  });


  // REQ-UI-011: Init spec command
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.initSpec', async () => {
      const specService = getSpecService();
      await specService.initSpec();
    })
  );

  // Select/switch between spec files
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.selectSpec', async () => {
      const specService = getSpecService();
      await specService.selectSpec();
    })
  );

  // REQ-UI-012: resolve a directory holding several .rqml files and no
  // requirements.rqml. Discovery reports these rather than skipping them.
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.resolveAmbiguousSpec', async () => {
      await getSpecService().resolveAmbiguity();
    })
  );

  // Select tree node (internal command for details view update)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.selectTreeNode', (node: TreeNode) => {
      treeProvider.selectNode(node);
    })
  );

  // REQ-UI-006K, REQ-UI-006L: Navigate to item by ID
  // This command finds an item by ID, reveals it in the tree, and updates both views
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.navigateToItem', async (itemId: string) => {
      if (!itemId) {
        return;
      }

      // Find the node by item ID
      const node = treeProvider.findNodeByItemId(itemId);

      if (!node) {
        vscode.window.showWarningMessage(`Item "${itemId}" not found in the specification.`);
        return;
      }

      // REQ-UI-006L: Reveal in tree view and select
      try {
        await treeView.reveal(node, { select: true, focus: true, expand: true });
      } catch {
        // reveal may fail if node is not in tree yet, still update selection
      }

      // Update selection (this also triggers details view update)
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
          if (!value.trim()) {
            return 'Title cannot be empty';
          }
          return null;
        }
      });

      if (!newTitle || newTitle === currentTitle) {
        return;
      }

      await applySpecEdit(
        (xml) => renameElement(xml, node.item!.id, newTitle),
        `rename ${node.item.id}`
      );
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

      if (confirm !== 'Delete') {
        return;
      }

      await applySpecEdit(
        (xml) => deleteElement(xml, node.item!.id),
        `delete ${node.item.id}`
      );
    })
  );

  // REQ-UI-006C: Add item to section
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.addItem', async (node: TreeNode) => {
      if (node.type !== 'section') {
        vscode.window.showInformationMessage('Select a section to add items.');
        return;
      }

      // Only the kinds core can produce a schema-valid snippet for. Offering
      // more would mean hand-writing XML here, which is the thing this avoids.
      const core = await loadCore();
      const kinds = [...core.SKELETON_KINDS];
      const kind = (await vscode.window.showQuickPick(kinds, {
        title: 'What kind of element?',
      })) as (typeof kinds)[number] | undefined;
      if (!kind) {return;}

      const id = await vscode.window.showInputBox({
        prompt: `Id for the new ${kind}`,
        placeHolder: kind === 'req' ? 'REQ-AREA-001' : undefined,
        validateInput: (value) =>
          /^[A-Za-z][A-Za-z0-9._-]{1,79}$/.test(value.trim())
            ? null
            : 'An id starts with a letter and uses letters, digits, dot, dash or underscore.',
      });
      if (!id) {return;}

      const container = kind === 'edge' ? 'trace' : 'reqPackage';
      const snippet = core.skeleton(kind, { id: id.trim() });

      await applySpecEdit(
        (xml) => insertIntoSection(xml, container, snippet),
        `add ${kind} ${id.trim()}`,
        kind === 'edge'
          ? 'A new edge starts with placeholder endpoints, which do not resolve. ' +
            'Point them at real ids before saving — the write is refused until they resolve.'
          : undefined
      );
    })
  );

  // REQ-UI-006I: Open document view
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openDocumentView', async () => {
      await documentViewProvider?.show();
    })
  );

  // REQ-UI-006I: Open trace view
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openTraceView', async () => {
      await traceGraphViewProvider?.show();
    })
  );

  // REQ-UI-006I: Open grid view (requirements matrix)
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.openGridView', async () => {
      await matrixViewProvider?.show();
    })
  );

  // REQ-EXP-005: Export functionality via wizard
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.export', async () => {
      await exportViewProvider?.show();
    })
  );
}
