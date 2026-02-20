// REQ-UI-006J: Traces view
// REQ-UI-006K: Clickable trace IDs
// REQ-UI-006L: Synchronized view updates
// The Traces region of the Sidebar shows trace edges for the selected item.

import * as vscode from 'vscode';
import { TreeNode } from './rqmlTreeProvider';
import { RqmlDocument, getTracesForItem } from '../services/rqmlParser';

/**
 * Trace item shown in the Traces view
 */
interface TraceItem {
  label: string;
  targetId: string;
  traceId: string;
  direction: 'outgoing' | 'incoming';
  traceType: string;
}

/**
 * RqmlTracesProvider - Provides data for the RQML Traces view.
 * Shows trace edges for the selected tree item.
 */
export class RqmlTracesProvider implements vscode.TreeDataProvider<TraceItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TraceItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private selectedNode?: TreeNode;
  private document?: RqmlDocument;

  setSelectedNode(node: TreeNode | undefined): void {
    this.selectedNode = node;
    this._onDidChangeTreeData.fire();
  }

  setDocument(doc: RqmlDocument | undefined): void {
    this.document = doc;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TraceItem): vscode.TreeItem {
    const arrow = element.direction === 'outgoing' ? '\u2192' : '\u2190';
    const item = new vscode.TreeItem(`${arrow} ${element.traceType}`);

    item.description = element.targetId;
    item.tooltip = `${element.direction === 'outgoing' ? 'Depends on' : 'Required by'}: ${element.targetId}\nTrace: ${element.traceId}`;
    item.iconPath = new vscode.ThemeIcon('arrow-both', new vscode.ThemeColor('icon.foreground'));
    item.collapsibleState = vscode.TreeItemCollapsibleState.None;
    item.contextValue = 'traceItem';

    // REQ-UI-006K: Clickable to navigate
    item.command = {
      command: 'rqml-vscode.navigateToItem',
      title: 'Navigate to Item',
      arguments: [element.targetId]
    };

    return item;
  }

  getChildren(): TraceItem[] {
    // No item selected
    if (!this.selectedNode) {
      return [];
    }

    // Only show traces for actual items (not root or sections)
    if (this.selectedNode.type !== 'item' || !this.selectedNode.item) {
      return [];
    }

    if (!this.document) {
      return [];
    }

    const itemId = this.selectedNode.item.id;
    const traces = getTracesForItem(this.document, itemId);

    if (traces.length === 0) {
      return [];
    }

    return traces.map(({ edge, direction }) => {
      const targetId = direction === 'outgoing'
        ? (edge.to || edge.toDisplay || '(external)')
        : (edge.from || edge.fromDisplay || '(external)');
      return {
        label: edge.type,
        targetId,
        traceId: edge.id,
        direction,
        traceType: edge.type
      };
    });
  }
}
