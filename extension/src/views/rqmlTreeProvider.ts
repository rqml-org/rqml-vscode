// REQ-UI-005: Tree view of specification
// REQ-UI-006A: Show all RQML sections including missing ones
// REQ-UI-006B: Visual distinction for missing sections
// REQ-UI-006G: Tree root labeled "RQML Spec"

import * as vscode from 'vscode';
import {
  RqmlDocument,
  RqmlSection,
  RqmlItem,
  RQML_SECTIONS,
  RqmlSectionName
} from '../services/rqmlParser';
import { getSpecService, SpecState } from '../services/specService';

/** Display labels for sections */
const SECTION_LABELS: Record<RqmlSectionName, string> = {
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

/** Codicon IDs for each node/item type */
const TYPE_ICON_IDS: Record<string, string> = {
  // Root
  root: 'book',

  // Sections
  meta: 'info',
  catalogs: 'library',
  domain: 'symbol-class',
  goals: 'target',
  scenarios: 'play-circle',
  requirements: 'checklist',
  behavior: 'git-compare',
  interfaces: 'plug',
  verification: 'beaker',
  trace: 'references',
  governance: 'law',

  // Item types
  reqPackage: 'package',
  req: 'circle-outline',
  FR: 'symbol-method',
  NFR: 'dashboard',
  IR: 'plug',
  DR: 'database',
  SR: 'shield',
  CR: 'lock',
  PR: 'law',
  UXR: 'eye',
  OR: 'server',
  goal: 'target',
  qgoal: 'graph',
  obstacle: 'warning',
  goalLink: 'arrow-both',
  term: 'symbol-text',
  actor: 'person',
  stakeholder: 'organization',
  constraint: 'lock',
  policy: 'law',
  decision: 'lightbulb',
  risk: 'warning',
  entity: 'symbol-class',
  rule: 'symbol-ruler',
  scenario: 'play',
  misuseCase: 'bug',
  edgeCase: 'symbol-event',
  stateMachine: 'git-compare',
  state: 'circle-filled',
  transition: 'arrow-right',
  api: 'globe',
  endpoint: 'link',
  event: 'zap',
  testSuite: 'test-view-icon',
  testCase: 'beaker',
  edge: 'arrow-both',
  issue: 'issues',
  approval: 'verified',
};

/** Default icon color (neutral foreground) */
const DEFAULT_ICON_COLOR = new vscode.ThemeColor('icon.foreground');

/** Status-based icon colors (defined in contributes.colors) */
const STATUS_COLORS: Record<string, vscode.ThemeColor> = {
  draft: new vscode.ThemeColor('rqml.statusDraft'),
  review: new vscode.ThemeColor('rqml.statusReview'),
  approved: new vscode.ThemeColor('rqml.statusApproved'),
  deprecated: new vscode.ThemeColor('rqml.statusDeprecated'),
};

/** Tree item types */
export type TreeNodeType = 'root' | 'section' | 'item' | 'message';

/** Tree node data */
export interface TreeNode {
  type: TreeNodeType;
  label: string;
  id: string;
  section?: RqmlSectionName;
  item?: RqmlItem;
  sectionData?: RqmlSection;
  children?: TreeNode[];
  /** Whether this section is missing from the document */
  missing?: boolean;
}

/**
 * RqmlTreeDataProvider - Provides data for the RQML specification tree view.
 */
export class RqmlTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private document?: RqmlDocument;
  private specState?: SpecState;
  private _selectedNode?: TreeNode;

  private _onDidSelectNode = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidSelectNode = this._onDidSelectNode.event;

  constructor() {
    // Listen for spec changes
    const specService = getSpecService();
    specService.onDidChangeSpec((state) => {
      this.specState = state;
      this.document = state.document;
      this._onDidChangeTreeData.fire();
    });
  }

  get selectedNode(): TreeNode | undefined {
    return this._selectedNode;
  }

  /** REQ-UI-006J: Get the current document for trace lookup */
  get currentDocument(): RqmlDocument | undefined {
    return this.document;
  }

  selectNode(node: TreeNode | undefined): void {
    this._selectedNode = node;
    this._onDidSelectNode.fire(node);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * REQ-UI-006K: Find a tree node by item ID.
   * Searches through all sections and their items.
   */
  findNodeByItemId(itemId: string): TreeNode | undefined {
    if (!this.document) {
      return undefined;
    }

    // Search through all sections
    for (const sectionName of RQML_SECTIONS) {
      const sectionData = this.document.sections.get(sectionName);
      if (!sectionData?.present) {
        continue;
      }

      // Search items in this section
      const found = this.findItemInList(sectionData.items, sectionName, itemId);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  /**
   * Recursively search for an item by ID in a list of items.
   */
  private findItemInList(items: RqmlItem[], sectionName: RqmlSectionName, itemId: string): TreeNode | undefined {
    for (const item of items) {
      if (item.id === itemId) {
        return this.createItemNode(item);
      }

      // Check children
      if (item.children) {
        const found = this.findItemInList(item.children, sectionName, itemId);
        if (found) {
          return found;
        }
      }
    }

    return undefined;
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      this.getCollapsibleState(element)
    );

    item.id = element.id;
    item.contextValue = this.getContextValue(element);
    item.iconPath = this.getIcon(element);

    // Message nodes (e.g. XSD warning)
    if (element.type === 'message') {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
      item.contextValue = 'rqmlMessage';
      return item;
    }

    // REQ-UI-006B: Visual distinction for missing sections
    if (element.missing) {
      item.description = '(not defined)';
      // Use a lighter color for missing sections by setting resourceUri
      item.resourceUri = vscode.Uri.parse('rqml:missing');
    }

    // Tooltip with details
    item.tooltip = this.getTooltip(element);

    // Command when clicking an item
    if (element.type === 'item' || element.type === 'section') {
      item.command = {
        command: 'rqml-vscode.selectTreeNode',
        title: 'Select',
        arguments: [element]
      };
    }

    return item;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    // Root level: show the "RQML Spec" root node
    if (!element) {
      return [this.createRootNode()];
    }

    // Under root: show all sections (with XSD warning if needed)
    if (element.type === 'root') {
      const children: TreeNode[] = [];
      if (this.specState?.status === 'single' && this.specState.xsdAvailable === false) {
        children.push({
          type: 'message',
          label: `Schema rqml-${this.specState.xsdVersion}.xsd not available`,
          id: 'xsd-warning',
        });
      }
      children.push(...this.createSectionNodes());
      return children;
    }

    // Under section: show items in that section
    if (element.type === 'section' && element.sectionData) {
      return this.createItemNodes(element.sectionData);
    }

    // Under item with children: show children
    if (element.type === 'item' && element.item?.children) {
      return element.item.children.map(child => this.createItemNode(child));
    }

    return [];
  }

  getParent(element: TreeNode): TreeNode | undefined {
    // Root has no parent
    if (element.type === 'root') {
      return undefined;
    }

    // Section's parent is root
    if (element.type === 'section') {
      return this.createRootNode();
    }

    // Item's parent is its section
    if (element.type === 'item' && element.section) {
      const sectionData = this.document?.sections.get(element.section);
      return {
        type: 'section',
        label: SECTION_LABELS[element.section],
        id: `section-${element.section}`,
        section: element.section,
        sectionData,
        missing: !sectionData?.present
      };
    }

    return undefined;
  }

  // REQ-UI-006G: Root node labeled "RQML Spec"
  private createRootNode(): TreeNode {
    const state = this.specState;

    let label = 'RQML Spec';
    if (state?.status === 'none') {
      label = 'RQML Spec (no file)';
    } else if (state?.status === 'multiple') {
      label = 'RQML Spec (error)';
    } else if (state?.status === 'invalid') {
      label = 'RQML Spec (invalid)';
    }

    return {
      type: 'root',
      label,
      id: 'root'
    };
  }

  // REQ-UI-006A: Show all sections including missing ones
  private createSectionNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];

    for (const sectionName of RQML_SECTIONS) {
      const sectionData = this.document?.sections.get(sectionName);

      nodes.push({
        type: 'section',
        label: SECTION_LABELS[sectionName],
        id: `section-${sectionName}`,
        section: sectionName,
        sectionData,
        missing: !sectionData?.present
      });
    }

    return nodes;
  }

  private createItemNodes(section: RqmlSection): TreeNode[] {
    return section.items.map(item => this.createItemNode(item));
  }

  private createItemNode(item: RqmlItem): TreeNode {
    const label = item.title || item.name || item.id;

    return {
      type: 'item',
      label,
      id: `item-${item.id}`,
      section: item.section,
      item,
      children: item.children?.map(c => this.createItemNode(c))
    };
  }

  private getCollapsibleState(node: TreeNode): vscode.TreeItemCollapsibleState {
    if (node.type === 'message') {
      return vscode.TreeItemCollapsibleState.None;
    }

    if (node.type === 'root') {
      return vscode.TreeItemCollapsibleState.Expanded;
    }

    if (node.type === 'section') {
      const hasItems = node.sectionData && node.sectionData.items.length > 0;
      return hasItems
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    }

    if (node.type === 'item' && node.item?.children && node.item.children.length > 0) {
      return vscode.TreeItemCollapsibleState.Collapsed;
    }

    return vscode.TreeItemCollapsibleState.None;
  }

  private getContextValue(node: TreeNode): string {
    // Context values must match package.json menu contributions
    if (node.type === 'root') {
      return this.specState?.status === 'none' ? 'rqmlRootEmpty' : 'rqmlRoot';
    }

    if (node.type === 'section') {
      return node.missing ? 'rqmlSectionMissing' : 'rqmlSection';
    }

    return 'rqmlItem';
  }

  private getIcon(node: TreeNode): vscode.ThemeIcon | undefined {
    let iconId: string | undefined;
    let color: vscode.ThemeColor = DEFAULT_ICON_COLOR;

    if (node.type === 'root') {
      iconId = TYPE_ICON_IDS.root;
    } else if (node.type === 'section' && node.section) {
      iconId = TYPE_ICON_IDS[node.section];
    } else if (node.type === 'item' && node.item) {
      iconId = TYPE_ICON_IDS[node.item.type] ?? TYPE_ICON_IDS.req;
      // Color by status attribute
      const status = node.item.status?.toLowerCase();
      if (status && STATUS_COLORS[status]) {
        color = STATUS_COLORS[status];
      }
    }

    return iconId ? new vscode.ThemeIcon(iconId, color) : undefined;
  }

  private getTooltip(node: TreeNode): string {
    if (node.type === 'root') {
      if (this.document) {
        return `${this.document.docId} (${this.document.status})`;
      }
      return 'No RQML specification loaded';
    }

    if (node.type === 'section') {
      if (node.missing) {
        return `${SECTION_LABELS[node.section!]} - Section not defined in specification`;
      }
      const count = node.sectionData?.items.length || 0;
      return `${SECTION_LABELS[node.section!]} - ${count} item${count !== 1 ? 's' : ''}`;
    }

    if (node.type === 'item' && node.item) {
      const parts: string[] = [];
      parts.push(`ID: ${node.item.id}`);
      if (node.item.type) parts.push(`Type: ${node.item.type}`);
      if (node.item.status) parts.push(`Status: ${node.item.status}`);
      if (node.item.priority) parts.push(`Priority: ${node.item.priority}`);
      return parts.join('\n');
    }

    return '';
  }
}
