// REQ-UI-011: Offer spec creation if no spec file present
// REQ-UI-012: Error on multiple spec files
// This service manages the RQML spec file lifecycle.

import * as vscode from 'vscode';
import { RqmlDocument, getRqmlParser } from './rqmlParser';
import { isXsdAvailable, getLatestXsdVersion } from './xsdVersions';

export type SpecStatus = 'none' | 'single' | 'multiple' | 'invalid';

export interface SpecState {
  status: SpecStatus;
  document?: RqmlDocument;
  files: vscode.Uri[];
  error?: string;
  /** Whether the matching XSD schema file is available for the document's version */
  xsdAvailable?: boolean;
  /** The RQML version from the document's root element */
  xsdVersion?: string;
}

/**
 * SpecService - Manages finding, loading, and watching the RQML spec file.
 */
export class SpecService {
  private _onDidChangeSpec = new vscode.EventEmitter<SpecState>();
  readonly onDidChangeSpec = this._onDidChangeSpec.event;

  private _state: SpecState = { status: 'none', files: [] };
  private watcher?: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];
  private extensionPath: string = '';

  constructor() {
    // Watch for .rqml file changes
    this.setupWatcher();

    // Also watch for workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh())
    );
  }

  initialize(extensionPath: string): void {
    this.extensionPath = extensionPath;
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
   * Find and load the RQML spec file(s) in the workspace root.
   */
  async refresh(): Promise<SpecState> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      this._state = { status: 'none', files: [] };
      this._onDidChangeSpec.fire(this._state);
      return this._state;
    }

    // Find .rqml files in the root of the workspace
    const rootUri = workspaceFolders[0].uri;
    const files: vscode.Uri[] = [];

    try {
      const entries = await vscode.workspace.fs.readDirectory(rootUri);
      for (const [name, type] of entries) {
        if (type === vscode.FileType.File && name.endsWith('.rqml')) {
          files.push(vscode.Uri.joinPath(rootUri, name));
        }
      }
    } catch {
      this._state = { status: 'none', files: [], error: 'Failed to read workspace directory' };
      this._onDidChangeSpec.fire(this._state);
      return this._state;
    }

    // REQ-UI-011: No spec file found
    if (files.length === 0) {
      this._state = { status: 'none', files: [] };
      this._onDidChangeSpec.fire(this._state);
      return this._state;
    }

    // REQ-UI-012: Multiple spec files found
    if (files.length > 1) {
      this._state = {
        status: 'multiple',
        files,
        error: `Multiple RQML spec files found: ${files.map(f => f.fsPath.split('/').pop()).join(', ')}`
      };
      this._onDidChangeSpec.fire(this._state);
      return this._state;
    }

    // Single spec file - parse it
    try {
      const parser = getRqmlParser();
      const document = await parser.parseFile(files[0]);

      const xsdAvail = this.extensionPath
        ? isXsdAvailable(this.extensionPath, document.version)
        : true;

      this._state = {
        status: 'single',
        files,
        document,
        xsdAvailable: xsdAvail,
        xsdVersion: document.version,
      };
    } catch (err) {
      this._state = {
        status: 'invalid',
        files,
        error: err instanceof Error ? err.message : 'Failed to parse RQML file'
      };
    }

    this._onDidChangeSpec.fire(this._state);
    return this._state;
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
