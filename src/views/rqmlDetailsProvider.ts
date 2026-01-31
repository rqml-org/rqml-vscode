// REQ-UI-006: Selection details view
// The Details region of the Sidebar shows properties for the selected item.

import * as vscode from 'vscode';
import { TreeNode } from './rqmlTreeProvider';
import { RqmlItem, RqmlSection, RqmlSectionName, RqmlDocument } from '../services/rqmlParser';

/**
 * Detail item shown in the details view
 */
interface DetailItem {
  label: string;
  value: string;
  type: 'property' | 'header' | 'text';
}

/**
 * RqmlDetailsProvider - Provides data for the RQML details view.
 * Shows properties and content of the selected tree item.
 */
export class RqmlDetailsProvider implements vscode.TreeDataProvider<DetailItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DetailItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private selectedNode?: TreeNode;
  private document?: RqmlDocument;

  setSelectedNode(node: TreeNode | undefined): void {
    this.selectedNode = node;
    this._onDidChangeTreeData.fire();
  }

  setDocument(doc: RqmlDocument | undefined): void {
    this.document = doc;
    // Document changes don't affect details view (traces moved to separate view)
  }

  getTreeItem(element: DetailItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);

    if (element.type === 'header') {
      item.iconPath = new vscode.ThemeIcon('symbol-property');
      item.description = '';
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (element.type === 'property') {
      item.description = element.value;
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      item.iconPath = new vscode.ThemeIcon('symbol-field');
    } else {
      item.description = element.value;
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    item.contextValue = 'detailItem';

    return item;
  }

  getChildren(): DetailItem[] {
    if (!this.selectedNode) {
      return [{
        label: 'Select an item',
        value: 'to view details',
        type: 'text'
      }];
    }

    if (this.selectedNode.type === 'root') {
      return this.getRootDetails();
    }

    if (this.selectedNode.type === 'section') {
      return this.getSectionDetails(this.selectedNode.sectionData, this.selectedNode.section);
    }

    if (this.selectedNode.type === 'item' && this.selectedNode.item) {
      return this.getItemDetails(this.selectedNode.item);
    }

    return [];
  }

  private getRootDetails(): DetailItem[] {
    const items: DetailItem[] = [];

    items.push({
      label: 'RQML Specification',
      value: '',
      type: 'header'
    });

    items.push({
      label: 'Click a section or item',
      value: 'to view its details',
      type: 'text'
    });

    return items;
  }

  private getSectionDetails(section: RqmlSection | undefined, sectionName: RqmlSectionName | undefined): DetailItem[] {
    const items: DetailItem[] = [];

    const label = sectionName ? this.formatSectionName(sectionName) : 'Section';

    items.push({
      label,
      value: '',
      type: 'header'
    });

    if (!section?.present) {
      items.push({
        label: 'Status',
        value: 'Not defined in specification',
        type: 'property'
      });

      items.push({
        label: 'Tip',
        value: 'Hover and click + to add items',
        type: 'text'
      });
    } else {
      items.push({
        label: 'Status',
        value: 'Defined',
        type: 'property'
      });

      items.push({
        label: 'Items',
        value: String(section.items.length),
        type: 'property'
      });

      // Show item types breakdown for requirements
      if (sectionName === 'requirements') {
        const typeCount: Record<string, number> = {};
        this.countItemTypes(section.items, typeCount);

        for (const [type, count] of Object.entries(typeCount)) {
          items.push({
            label: `  ${type}`,
            value: String(count),
            type: 'property'
          });
        }
      }
    }

    return items;
  }

  private getItemDetails(rqmlItem: RqmlItem): DetailItem[] {
    const items: DetailItem[] = [];

    // Header with title or ID
    items.push({
      label: rqmlItem.title || rqmlItem.name || rqmlItem.id,
      value: '',
      type: 'header'
    });

    // Standard properties
    items.push({
      label: 'ID',
      value: rqmlItem.id,
      type: 'property'
    });

    if (rqmlItem.type) {
      items.push({
        label: 'Type',
        value: rqmlItem.type,
        type: 'property'
      });
    }

    if (rqmlItem.status) {
      items.push({
        label: 'Status',
        value: rqmlItem.status,
        type: 'property'
      });
    }

    if (rqmlItem.priority) {
      items.push({
        label: 'Priority',
        value: rqmlItem.priority,
        type: 'property'
      });
    }

    // Section
    items.push({
      label: 'Section',
      value: this.formatSectionName(rqmlItem.section),
      type: 'property'
    });

    // Line number if available
    if (rqmlItem.line) {
      items.push({
        label: 'Line',
        value: String(rqmlItem.line),
        type: 'property'
      });
    }

    // Children count
    if (rqmlItem.children && rqmlItem.children.length > 0) {
      items.push({
        label: 'Children',
        value: String(rqmlItem.children.length),
        type: 'property'
      });
    }

    // Extract statement if present (for requirements)
    const raw = rqmlItem.raw as Record<string, unknown>;
    if (raw.statement) {
      const statement = typeof raw.statement === 'string'
        ? raw.statement
        : (raw.statement as Record<string, unknown>)['#text'] as string || '';

      if (statement) {
        items.push({
          label: 'Statement',
          value: this.truncate(statement, 100),
          type: 'text'
        });
      }
    }

    return items;
  }

  private countItemTypes(rqmlItems: RqmlItem[], counts: Record<string, number>): void {
    for (const item of rqmlItems) {
      if (item.type && item.type !== 'reqPackage') {
        counts[item.type] = (counts[item.type] || 0) + 1;
      }
      if (item.children) {
        this.countItemTypes(item.children, counts);
      }
    }
  }

  private formatSectionName(name: RqmlSectionName): string {
    const labels: Record<RqmlSectionName, string> = {
      meta: 'Metadata',
      catalogs: 'Catalogs',
      domain: 'Domain',
      goals: 'Goals',
      scenarios: 'Scenarios',
      requirements: 'Requirements',
      behavior: 'Behavior',
      interfaces: 'Interfaces',
      verification: 'Verification',
      trace: 'Traceability',
      governance: 'Governance'
    };
    return labels[name] || name;
  }

  private truncate(text: string, maxLength: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength - 3) + '...';
  }
}
