// REQ-UI-011: Offer spec creation if no spec file present
// This service manages the RQML spec file lifecycle.
// Supports multiple .rqml files with active spec switching.

import * as vscode from 'vscode';
import * as path from 'path';
import { RqmlDocument, getRqmlParser } from './rqmlParser';
import { loadSchema } from './core';

export type SpecStatus = 'none' | 'single' | 'invalid';

export interface SpecState {
  status: SpecStatus;
  document?: RqmlDocument;
  files: vscode.Uri[];
  /** The currently active spec file URI (when multiple exist) */
  activeSpecUri?: vscode.Uri;
  error?: string;
  /** Whether a bundled XSD is available for the document's declared version */
  xsdAvailable?: boolean;
  /** The RQML version from the document's root element */
  xsdVersion?: string;
  /** The schema versions this build can validate, oldest first */
  supportedSchemaVersions?: string[];
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
   * Reduce a flat list of discovered .rqml files to the set of "unit specs"
   * worth offering in the switcher, applying the REQ-UI-015 naming convention
   * per directory: a directory's spec is `requirements.rqml` if present, else
   * the sole `*.rqml` in that directory. Directories with multiple .rqml files
   * and no `requirements.rqml` contribute nothing — this excludes example
   * folders and test fixtures that bundle many .rqml files in one directory.
   */
  private filterUnitSpecs(files: vscode.Uri[]): vscode.Uri[] {
    const byDir = new Map<string, vscode.Uri[]>();
    for (const uri of files) {
      const dir = path.dirname(uri.fsPath);
      const list = byDir.get(dir) || [];
      list.push(uri);
      byDir.set(dir, list);
    }

    const result: vscode.Uri[] = [];
    for (const list of byDir.values()) {
      const requirements = list.find(u => path.basename(u.fsPath) === 'requirements.rqml');
      if (requirements) {
        result.push(requirements);
      } else if (list.length === 1) {
        result.push(list[0]);
      }
      // Multiple .rqml in a directory with no requirements.rqml → skip the directory.
    }
    return result;
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

    // Merge, deduplicate, then reduce to one spec per project unit so the
    // switcher lists real specs only (not example/fixture .rqml bundles).
    const allFiles = this.filterUnitSpecs(
      this.deduplicateUris([...workspaceFiles, ...parentFiles])
    );

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

      // Schema availability comes from @rqml/schema, the same catalogue the
      // engine validates against, rather than from files we ship ourselves.
      const schema = await loadSchema();
      const supported = schema.supportedSchemaVersions();

      this._state = {
        status: 'single',
        files: allFiles,
        activeSpecUri: activeUri,
        document,
        xsdAvailable: schema.isSchemaVersion(document.version),
        xsdVersion: document.version,
        supportedSchemaVersions: supported,
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

    // REQ-UI-011 AC-UI-011-02: create at the newest schema version this build
    // supports. The namespace and schemaLocation URLs come from @rqml/schema
    // rather than being assembled here, so a new schema version needs no change
    // in this file and the two URLs can never drift apart.
    const schema = await loadSchema();
    const version = schema.DEFAULT_SCHEMA_VERSION;

    const template = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="${schema.schemaNamespace(version)}"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="${schema.schemaNamespace(version)} ${schema.schemaUrl(version)}"
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
