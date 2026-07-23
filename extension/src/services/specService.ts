// REQ-UI-011: Offer spec creation if no spec file present
// REQ-UI-012: Report an ambiguous directory rather than silently skipping it
// REQ-UI-015: Resolve the governing spec by nearest enclosing directory
// REQ-UI-016: Follow the active editor between project units
// REQ-UI-018: Never cross a workspace folder boundary
//
// Discovery is @rqml/core's (ADR-0007), not this file's. The engine answers
// "which spec governs this file" for the CLI, the MCP server and the agent
// plugins; a second implementation here would eventually answer differently,
// and a gate that disagrees with the build is the one outcome ADR-0006 forbids.

import * as vscode from 'vscode';
import * as path from 'path';
import { RqmlDocument, getRqmlParser } from './rqmlParser';
import { loadCore, loadSchema } from './core';
import { log } from './logger';

export type SpecStatus = 'none' | 'single' | 'invalid';

/** A directory holding several `*.rqml` files and no `requirements.rqml`. */
export interface AmbiguousSpecDir {
  dir: string;
  candidates: string[];
}

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
  /**
   * REQ-UI-012: directories the engine could not resolve to a single spec.
   *
   * The previous implementation dropped these silently, so a genuine
   * configuration problem looked like an empty directory.
   */
  ambiguous?: AmbiguousSpecDir[];
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
  private context?: vscode.ExtensionContext;

  constructor() {
    // Watch for .rqml file changes
    this.setupWatcher();

    // Also watch for workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh())
    );

    // REQ-UI-016: follow the active editor between project units.
    //
    // Only acts when the governing spec actually differs, because every
    // refresh re-parses the document and fires an event six subscribers react
    // to — including the gate, which recomputes its verdict. Resolution itself
    // is a sub-millisecond filesystem walk, so it can run on every editor
    // change without a cache (which is why REQ-UI-017 remains unimplemented).
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor) {return;}
        void this.followActiveEditor(editor.document.uri);
      })
    );
  }

  /** Switch the active spec when the editor moves to a file another unit governs. */
  private async followActiveEditor(uri: vscode.Uri): Promise<void> {
    const governing = await this.resolveGoverningSpec(uri);
    if (!governing) {return;}
    if (governing.fsPath === this._state.activeSpecUri?.fsPath) {return;}
    if (!this._state.files.some((f) => f.fsPath === governing.fsPath)) {return;}

    log.info('Spec', `active unit changed to ${path.basename(path.dirname(governing.fsPath))}`);
    await this.persistActiveSpec(governing);
    await this.refresh();
  }

  /**
   * `context` supplies workspaceState, where the active-spec choice persists.
   *
   * The former `extensionPath` parameter is gone: it was needed to locate the
   * XSDs this extension used to ship, which @rqml/schema replaced.
   */
  initialize(context?: vscode.ExtensionContext): void {
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
   * REQ-UI-012 AC-02: the user's choice of primary spec for a directory the
   * engine reports as ambiguous, keyed by directory.
   *
   * Kept here rather than pushed into the engine: `requirements.rqml` is the
   * convention, and a per-workspace override is an editor affordance for
   * getting un-stuck, not a change to what the convention means. The CLI must
   * still report the directory as ambiguous, because it is.
   */
  private getSpecOverrides(): Record<string, string> {
    return this.context?.workspaceState.get<Record<string, string>>('rqml.specOverrides') ?? {};
  }

  private async setSpecOverride(dir: string, specPath: string): Promise<void> {
    await this.context?.workspaceState.update('rqml.specOverrides', {
      ...this.getSpecOverrides(),
      [dir]: specPath,
    });
  }

  /**
   * Enumerate the project units in every workspace folder.
   *
   * REQ-UI-018: each folder is scanned independently and is its own boundary,
   * so a multi-root workspace cannot leak one folder's spec into another. The
   * previous implementation scanned all folders with one glob but searched only
   * `workspaceFolders[0]`'s parents, so folder 2's ancestors were never
   * considered while folder 1's were — and, having no boundary at all, that
   * search escaped the workspace entirely.
   *
   * No `ignore` is passed: the engine never descends `node_modules` or any
   * dot-directory, which is both faster than a glob with excludes and immune to
   * a user's `search.exclude` being configured away.
   */
  private async discoverUnits(): Promise<{
    files: vscode.Uri[];
    ambiguous: AmbiguousSpecDir[];
  }> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const core = await loadCore();

    const files: vscode.Uri[] = [];
    const ambiguous: AmbiguousSpecDir[] = [];
    const seen = new Set<string>();

    for (const folder of folders) {
      if (folder.uri.scheme !== 'file') {
        // ADR-0007 records the extension as node-only; the engine reads the
        // filesystem directly and cannot see a virtual workspace.
        log.info('Spec', `skipping non-file workspace folder: ${folder.uri.toString()}`);
        continue;
      }
      try {
        const report = core.discoverSpecs(folder.uri.fsPath);
        for (const spec of report.specs) {
          if (seen.has(spec.specPath)) {continue;}
          seen.add(spec.specPath);
          files.push(vscode.Uri.file(spec.specPath));
        }
        // REQ-UI-012 AC-02: a directory the user has already chosen a primary
        // spec for is no longer ambiguous *to the editor*. If the chosen file
        // has since gone, the directory goes back to being ambiguous rather
        // than silently disappearing.
        const overrides = this.getSpecOverrides();
        for (const dir of report.ambiguous) {
          const chosen = overrides[dir.dir];
          if (chosen && dir.candidates.includes(path.basename(chosen)) && !seen.has(chosen)) {
            seen.add(chosen);
            files.push(vscode.Uri.file(chosen));
            continue;
          }
          ambiguous.push({ dir: dir.dir, candidates: [...dir.candidates] });
        }
      } catch (err) {
        // Previously swallowed with an empty catch, which reported "no spec"
        // for what was actually a filesystem failure.
        log.error('Spec', `discovery failed in ${folder.uri.fsPath}`, err);
      }
    }

    return { files, ambiguous };
  }

  /**
   * Resolve which discovered spec should be active.
   *
   * Priority: the spec governing the active editor (REQ-UI-015, REQ-UI-016) →
   * the persisted choice → the first discovered unit. Governing-spec resolution
   * comes first so that moving between units in a monorepo follows the file you
   * are actually editing, which is the behaviour the rest of the portfolio has.
   */
  private async resolveActiveSpec(files: vscode.Uri[]): Promise<vscode.Uri> {
    const governing = await this.resolveGoverningSpec();
    if (governing && files.some((f) => f.fsPath === governing.fsPath)) {return governing;}

    const persisted = this.getPersistedActiveSpec();
    if (persisted) {
      const match = files.find((f) => f.fsPath === persisted);
      if (match) {return match;}
    }
    return files[0];
  }

  /**
   * The spec governing the active editor's file, if any.
   *
   * `root` is always the containing workspace folder. Without it the engine
   * falls back to a `.git`/`.hg` marker, which is a reasonable default for a
   * CLI but wrong for an editor: a workspace folder that is not itself a
   * repository would resolve to a spec outside the workspace. That is exactly
   * the defect this replaces.
   */
  async resolveGoverningSpec(target?: vscode.Uri): Promise<vscode.Uri | undefined> {
    const uri = target ?? vscode.window.activeTextEditor?.document.uri;
    if (!uri || uri.scheme !== 'file') {return undefined;}

    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder || folder.uri.scheme !== 'file') {return undefined;}

    try {
      const core = await loadCore();
      const resolution = core.resolveGoverningSpec(uri.fsPath, { root: folder.uri.fsPath });
      if (resolution.kind === 'resolved') {return vscode.Uri.file(resolution.specPath);}
      // 'ambiguous' and 'none' both mean "no single governing spec"; ambiguity
      // is surfaced from the discovery report rather than guessed at here.
      return undefined;
    } catch (err) {
      log.error('Spec', `could not resolve the governing spec for ${uri.fsPath}`, err);
      return undefined;
    }
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

    const { files: allFiles, ambiguous } = await this.discoverUnits();

    // REQ-UI-011: No spec file found
    if (allFiles.length === 0) {
      this._state = { status: 'none', files: [], ambiguous };
      this._onDidChangeSpec.fire(this._state);
      return this._state;
    }

    // Select the active spec
    const activeUri = await this.resolveActiveSpec(allFiles);

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
        ambiguous,
      };
    } catch (err) {
      this._state = {
        status: 'invalid',
        files: allFiles,
        activeSpecUri: activeUri,
        error: err instanceof Error ? err.message : 'Failed to parse RQML file',
        ambiguous,
      };
    }

    this._onDidChangeSpec.fire(this._state);
    return this._state;
  }

  /**
   * REQ-UI-012 AC-02/AC-03: resolve an ambiguous directory.
   *
   * Offers the two remedies the requirement names. Renaming is offered first
   * because it fixes the directory for everyone — the CLI, CI and every
   * teammate — whereas choosing a primary spec only quiets this workspace.
   */
  async resolveAmbiguity(dir?: AmbiguousSpecDir): Promise<void> {
    const ambiguous = this._state.ambiguous ?? [];
    if (ambiguous.length === 0) {
      vscode.window.showInformationMessage('RQML: no ambiguous specification directories.');
      return;
    }

    let target = dir;
    if (!target) {
      const picked = await vscode.window.showQuickPick(
        ambiguous.map((a) => ({
          label: vscode.workspace.asRelativePath(a.dir),
          description: `${a.candidates.length} candidates`,
          detail: a.candidates.join(', '),
          entry: a,
        })),
        { title: 'Which directory should be resolved?' }
      );
      if (!picked) {return;}
      target = picked.entry;
    }

    const action = await vscode.window.showQuickPick(
      [
        {
          label: '$(edit) Rename to requirements.rqml',
          detail: 'Fixes the directory for the CLI, CI and everyone else. Recommended.',
          id: 'rename' as const,
        },
        {
          label: '$(check) Choose primary spec',
          detail: 'Records a choice for this workspace only; the directory stays ambiguous elsewhere.',
          id: 'choose' as const,
        },
      ],
      { title: `${target.candidates.length} specifications in ${vscode.workspace.asRelativePath(target.dir)}` }
    );
    if (!action) {return;}

    const file = await vscode.window.showQuickPick(target.candidates, {
      title: action.id === 'rename' ? 'Rename which file?' : 'Which file governs this directory?',
    });
    if (!file) {return;}

    const from = vscode.Uri.file(path.join(target.dir, file));

    if (action.id === 'rename') {
      const to = vscode.Uri.file(path.join(target.dir, 'requirements.rqml'));
      try {
        await vscode.workspace.fs.rename(from, to, { overwrite: false });
        log.info('Spec', `renamed ${file} to requirements.rqml in ${target.dir}`);
        vscode.window.showInformationMessage(`RQML: renamed ${file} to requirements.rqml.`);
      } catch (err) {
        log.error('Spec', `could not rename ${from.fsPath}`, err);
        vscode.window.showErrorMessage(
          `RQML: could not rename ${file}. A requirements.rqml may already exist there.`
        );
        return;
      }
    } else {
      await this.setSpecOverride(target.dir, from.fsPath);
      await this.persistActiveSpec(from);
      vscode.window.showInformationMessage(`RQML: ${file} now governs that directory in this workspace.`);
    }

    await this.refresh();
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
    if (!picked) {return;}

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
        if (!value.trim()) {return 'Filename is required';}
        if (/[/\\:*?"<>|]/.test(value)) {return 'Filename contains invalid characters';}
        return null;
      }
    });
    if (baseName === undefined) {return undefined;}

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
        if (!value.trim()) {return 'Document ID is required';}
        return null;
      }
    });
    if (docId === undefined) {return undefined;}

    // Step 3: Title
    const defaultTitle = `${projectName} — Requirements Specification`;
    const title = await vscode.window.showInputBox({
      title: 'RQML: Init Spec (3/3)',
      prompt: 'Specification title',
      value: defaultTitle,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) {return 'Title is required';}
        return null;
      }
    });
    if (title === undefined) {return undefined;}

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
