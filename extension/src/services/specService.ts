// REQ-UI-011: Offer spec creation if no spec file present
// This service manages the RQML spec file lifecycle.
// Supports multiple .rqml files with active spec switching.

import * as vscode from 'vscode';
import * as path from 'path';
import { RqmlDocument, getRqmlParser } from './rqmlParser';
import { isXsdAvailable, getLatestXsdVersion } from './xsdVersions';

export type SpecStatus = 'none' | 'single' | 'invalid';

export interface SpecState {
  status: SpecStatus;
  document?: RqmlDocument;
  files: vscode.Uri[];
  /** The currently active spec file URI (when multiple exist) */
  activeSpecUri?: vscode.Uri;
  error?: string;
  /** Whether the matching XSD schema file is available for the document's version */
  xsdAvailable?: boolean;
  /** The RQML version from the document's root element */
  xsdVersion?: string;
}

/**
 * SpecService - Manages finding, loading, and watching the RQML spec file.
 * Supports multiple .rqml files with active spec selection and persistence.
 */
export class SpecService {
  private _onDidChangeSpec = new vscode.EventEmitter<SpecState>();
  readonly onDidChangeSpec = this._onDidChangeSpec.event;

  private _state: SpecState = { status: 'none', files: [] };
  private watcher?: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];
  private extensionPath: string = '';
  private context?: vscode.ExtensionContext;

  constructor() {
    // Watch for .rqml file changes
    this.setupWatcher();

    // Also watch for workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh())
    );
  }

  initialize(extensionPath: string, context?: vscode.ExtensionContext): void {
    this.extensionPath = extensionPath;
    this.context = context;
  }

  get state(): SpecState {
    return this._state;
  }

  private setupWatcher(): void {
    this.watcher?.dispose();
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*.rqml');

    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
    this.watcher.onDidChange(() => this.refresh());

    this.disposables.push(this.watcher);
  }

  /**
   * Get the persisted active spec path from workspace state.
   */
  private getPersistedActiveSpec(): string | undefined {
    return this.context?.workspaceState.get<string>('rqml.activeSpecPath');
  }

  /**
   * Persist the active spec path in workspace state.
   */
  private async persistActiveSpec(uri: vscode.Uri): Promise<void> {
    await this.context?.workspaceState.update('rqml.activeSpecPath', uri.fsPath);
  }

  /**
   * Search parent directories above the workspace root for .rqml files.
   * Useful in monorepo setups where the editor opens a subdirectory.
   */
  private async searchParentDirectories(workspaceUri: vscode.Uri): Promise<vscode.Uri[]> {
    const found: vscode.Uri[] = [];
    let current = workspaceUri;

    for (let i = 0; i < 5; i++) {
      const parent = vscode.Uri.joinPath(current, '..');
      // Stop if we've reached the filesystem root
      if (parent.fsPath === current.fsPath) break;
      current = parent;

      try {
        const entries = await vscode.workspace.fs.readDirectory(current);
        for (const [name, type] of entries) {
          if (type === vscode.FileType.File && name.endsWith('.rqml')) {
            found.push(vscode.Uri.joinPath(current, name));
          }
        }
      } catch {
        // Cannot read directory (permissions, etc.) — stop walking
        break;
      }
    }

    return found;
  }

  /**
   * Deduplicate URIs by fsPath.
   */
  private deduplicateUris(uris: vscode.Uri[]): vscode.Uri[] {
    const seen = new Set<string>();
    return uris.filter(uri => {
      if (seen.has(uri.fsPath)) return false;
      seen.add(uri.fsPath);
      return true;
    });
  }

  /**
   * Resolve which spec file should be active from the list of discovered files.
   * Priority: persisted path → sole file → first file.
   */
  private resolveActiveSpec(files: vscode.Uri[]): vscode.Uri {
    const persisted = this.getPersistedActiveSpec();
    if (persisted) {
      const match = files.find(f => f.fsPath === persisted);
      if (match) return match;
    }
    return files[0];
  }

  /**
   * Find and load the RQML spec file(s) in the workspace.
   * Searches workspace recursively and parent directories.
   */
  async refresh(): Promise<SpecState> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      this._state = { status: 'none', files: [] };
      this._onDidChangeSpec.fire(this._state);
      return this._state;
    }

    // Find all .rqml files within the workspace (recursive)
    let workspaceFiles: vscode.Uri[] = [];
    try {
      workspaceFiles = await vscode.workspace.findFiles('**/*.rqml');
    } catch {
      // findFiles can fail in some remote workspace scenarios
    }

    // Search parent directories for monorepo setups
    const parentFiles = await this.searchParentDirectories(workspaceFolders[0].uri);

    // Merge and deduplicate
    const allFiles = this.deduplicateUris([...workspaceFiles, ...parentFiles]);

    // REQ-UI-011: No spec file found
    if (allFiles.length === 0) {
      this._state = { status: 'none', files: [] };
      this._onDidChangeSpec.fire(this._state);
      return this._state;
    }

    // Select the active spec
    const activeUri = this.resolveActiveSpec(allFiles);

    // Parse the active spec file
    try {
      const parser = getRqmlParser();
      const document = await parser.parseFile(activeUri);

      const xsdAvail = this.extensionPath
        ? isXsdAvailable(this.extensionPath, document.version)
        : true;

      this._state = {
        status: 'single',
        files: allFiles,
        activeSpecUri: activeUri,
        document,
        xsdAvailable: xsdAvail,
        xsdVersion: document.version,
      };
    } catch (err) {
      this._state = {
        status: 'invalid',
        files: allFiles,
        activeSpecUri: activeUri,
        error: err instanceof Error ? err.message : 'Failed to parse RQML file'
      };
    }

    this._onDidChangeSpec.fire(this._state);
    return this._state;
  }

  /**
   * Show a QuickPick to switch between discovered .rqml files.
   */
  async selectSpec(uri?: vscode.Uri): Promise<void> {
    if (uri) {
      await this.persistActiveSpec(uri);
      await this.refresh();
      return;
    }

    const files = this._state.files;
    if (files.length === 0) {
      vscode.window.showInformationMessage('No RQML spec files found in this workspace.');
      return;
    }

    if (files.length === 1) {
      vscode.window.showInformationMessage(`Only one RQML spec file found: ${path.basename(files[0].fsPath)}`);
      return;
    }

    const items = files.map(f => ({
      label: path.basename(f.fsPath),
      description: vscode.workspace.asRelativePath(f),
      detail: f.fsPath === this._state.activeSpecUri?.fsPath ? '$(check) Active' : undefined,
      uri: f,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an RQML spec file',
    });
    if (!picked) return;

    await this.persistActiveSpec(picked.uri);
    await this.refresh();
  }

  /**
   * Initialize a new RQML spec file with a multi-step input flow.
   * Prompts for filename, docId, and title — each with sensible defaults.
   */
  async initSpec(): Promise<vscode.Uri | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
      return undefined;
    }

    const rootUri = workspaceFolders[0].uri;
    const projectName = rootUri.fsPath.split('/').pop() || 'Project';

    // Step 1: Filename (without extension)
    const baseName = await vscode.window.showInputBox({
      title: 'RQML: Init Spec (1/3)',
      prompt: 'Filename (the .rqml extension is added automatically)',
      value: 'requirements',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) return 'Filename is required';
        if (/[/\\:*?"<>|]/.test(value)) return 'Filename contains invalid characters';
        return null;
      }
    });
    if (baseName === undefined) return undefined;

    const fileName = baseName.endsWith('.rqml') ? baseName : `${baseName}.rqml`;
    const fileUri = vscode.Uri.joinPath(rootUri, fileName);

    // Check if file already exists
    try {
      await vscode.workspace.fs.stat(fileUri);
      vscode.window.showErrorMessage(`File ${fileName} already exists.`);
      return undefined;
    } catch {
      // File doesn't exist, good to create
    }

    // Step 2: Document ID
    const defaultDocId = `DOC-${projectName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`;
    const docId = await vscode.window.showInputBox({
      title: 'RQML: Init Spec (2/3)',
      prompt: 'Document ID',
      value: defaultDocId,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) return 'Document ID is required';
        return null;
      }
    });
    if (docId === undefined) return undefined;

    // Step 3: Title
    const defaultTitle = `${projectName} — Requirements Specification`;
    const title = await vscode.window.showInputBox({
      title: 'RQML: Init Spec (3/3)',
      prompt: 'Specification title',
      value: defaultTitle,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) return 'Title is required';
        return null;
      }
    });
    if (title === undefined) return undefined;

    // REQ-UI-011 AC-UI-011-02: Use the most recent available XSD version
    const version = (this.extensionPath && getLatestXsdVersion(this.extensionPath)) || '2.1.0';

    const template = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/${version}"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="https://rqml.org/schema/${version} https://rqml.org/schema/rqml-${version}.xsd"
      version="${version}" docId="${docId}" status="draft">
  <meta>
    <title>${title}</title>
    <system>${projectName}</system>
  </meta>
  <requirements>
    <!-- Add your requirements here -->
  </requirements>
</rqml>
`;

    try {
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(template, 'utf-8'));
      await this.persistActiveSpec(fileUri);
      await this.refresh();

      // Open the file
      const doc = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(doc);

      return fileUri;
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to create spec file: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      return undefined;
    }
  }

  dispose(): void {
    this._onDidChangeSpec.dispose();
    this.watcher?.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton instance */
let specServiceInstance: SpecService | undefined;

export function getSpecService(): SpecService {
  if (!specServiceInstance) {
    specServiceInstance = new SpecService();
  }
  return specServiceInstance;
}
