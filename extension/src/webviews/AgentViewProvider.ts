// REQ-AGT-001: Agent panel tab
// REQ-AGT-002: Prompt input
// REQ-AGT-004: RQML file change monitoring
// REQ-AGT-005: Codebase change monitoring
// REQ-AGT-008: User-confirmed modifications

import * as vscode from 'vscode';
import { getWebviewContent } from './shared/getWebviewContent';
import { getAgentService } from '../services/agentService';
import { getSpecService } from '../services/specService';
import { getModelCatalogService } from '../services/modelCatalogService';
import { getConfigurationService } from '../services/configurationService';

/**
 * WebviewViewProvider for the RQML Agent panel tab.
 * Hosts the chat-style agent interface in the sidebar.
 */
export class AgentViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rqmlAgentView';

  private view: vscode.WebviewView | undefined;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private terminal: vscode.Terminal | undefined;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'resources'),
      ]
    };

    const logoUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'RQML_logo_transparent.png')
    );

    // Colored RQML icon variants for spec health indicator
    const iconColors = ['gray', 'yellow', 'green', 'red', 'blue'] as const;
    const rqmlIcons: Record<string, string> = {};
    for (const color of iconColors) {
      rqmlIcons[color] = webviewView.webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'resources', `rqml-${color}.png`)
      ).toString();
    }

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.extensionUri,
      'agent',
      'RQML AGENT',
      { logoUri: logoUri.toString(), rqmlIcons: JSON.stringify(rqmlIcons) }
    );

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      this.handleMessage.bind(this),
      undefined,
      this.disposables
    );

    // Listen for agent service messages
    const agentService = getAgentService();
    this.disposables.push(
      agentService.onDidReceiveMessage((msg) => {
        this.postToWebview(msg);
      })
    );

    // Listen for spec state changes and push health updates to webview
    const specService = getSpecService();
    this.disposables.push(
      specService.onDidChangeSpec(() => {
        this.sendSpecHealth();
      })
    );
    // Send initial spec health after a short delay (spec may not be loaded yet)
    setTimeout(() => this.sendSpecHealth(), 500);

    webviewView.onDidDispose(() => {
      this.disposables.forEach(d => d.dispose());
      this.disposables = [];
      this.view = undefined;
    });
  }

  /**
   * Post a message to the agent webview
   */
  postToWebview(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  private async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
    const agentService = getAgentService();

    switch (message.type) {
      case 'sendPrompt': {
        // REQ-AGT-002: User submitted a prompt
        const { text, images, files } = message.payload as {
          text: string;
          images?: Array<{ dataUrl: string; mediaType: string }>;
          files?: Array<{ path: string; isDirectory: boolean }>;
        };
        // If files are attached, read their contents and inject into the prompt
        let augmentedText = text;
        if (files?.length) {
          const filePaths = files.map(f => f.path);
          const contents = await this.readFileContents(filePaths);
          if (contents.length > 0) {
            const contextBlock = contents
              .map(f => `--- ${f.path} ---\n${f.content}`)
              .join('\n\n');
            augmentedText = `${text}\n\n<attached-context>\n${contextBlock}\n</attached-context>`;
          }
        }
        await agentService.handleUserMessage(augmentedText, images);
        break;
      }
      case 'acceptChange': {
        // REQ-AGT-008: User accepted a proposed change
        const { changeId } = message.payload as { changeId: string };
        await agentService.applyChange(changeId);
        break;
      }
      case 'rejectChange': {
        // REQ-AGT-008: User rejected a proposed change
        const { changeId } = message.payload as { changeId: string };
        agentService.rejectChange(changeId);
        break;
      }
      case 'allowAllChanges': {
        // REQ-AGT-008 AC-AGT-008-04: Allow all for remainder of session
        agentService.setAutoApprove(true);
        break;
      }
      case 'requestEndpoints': {
        // Send current endpoint configuration to webview
        await agentService.sendEndpointStatus();
        break;
      }
      case 'requestStartupStatus': {
        const status = await agentService.getStartupStatus();
        this.postToWebview({ type: 'startupStatus', payload: status });
        break;
      }
      case 'requestCommandList': {
        // REQ-CMD-002: Send command names to webview for autocomplete
        const names = agentService.commandRegistry.getAllNames();
        this.postToWebview({ type: 'commandList', payload: { names } });
        break;
      }
      case 'navigateToRequirement': {
        // REQ-CMD-003: Navigate to a requirement ID in the spec file
        const { id } = message.payload as { id: string };
        await this.navigateToRequirement(id);
        break;
      }
      case 'copyToClipboard': {
        const { content } = message.payload as { content: string };
        await vscode.env.clipboard.writeText(content);
        vscode.window.setStatusBarMessage('Copied to clipboard.', 3000);
        break;
      }
      case 'approveToolCall': {
        const { approvalId } = message.payload as { approvalId: string };
        agentService.resolveToolApproval(approvalId, true);
        break;
      }
      case 'rejectToolCall': {
        const { approvalId } = message.payload as { approvalId: string };
        agentService.resolveToolApproval(approvalId, false);
        break;
      }
      case 'allowAllToolCalls': {
        const { approvalId } = message.payload as { approvalId: string };
        agentService.setAutoApproveTools(true);
        agentService.resolveToolApproval(approvalId, true);
        break;
      }
      case 'respondToChoice': {
        const { choiceId, selected } = message.payload as { choiceId: string; selected: string };
        agentService.resolveUserChoice(choiceId, selected);
        break;
      }
      case 'requestModelList': {
        await this.sendModelList();
        break;
      }
      case 'requestSpecHealth': {
        this.sendSpecHealth();
        break;
      }
      case 'selectModel': {
        const { modelId } = message.payload as { modelId: string };
        await this.handleSelectModel(modelId);
        break;
      }
      case 'runInTerminal': {
        const { command } = message.payload as { command: string };
        this.runInTerminal(command);
        break;
      }
      case 'listWorkspaceFiles': {
        const { relativePath } = message.payload as { relativePath: string };
        await this.listWorkspaceFiles(relativePath);
        break;
      }
    }
  }

  /**
   * Determine and send the spec health color to the webview.
   *
   * gray:   No spec
   * yellow: Spec exists but is not implementation-ready
   * green:  Spec is implementation-ready; code behind spec
   * red:    Spec exists but is behind code
   * blue:   Spec is implementation-ready and code is in sync
   */
  private sendSpecHealth(): void {
    const specService = getSpecService();
    const state = specService.state;

    let health: 'gray' | 'yellow' | 'green' | 'red' | 'blue' = 'gray';

    if (state.status === 'none') {
      health = 'gray';
    } else if (state.status === 'multiple' || state.status === 'invalid') {
      health = 'yellow';
    } else if (state.status === 'single' && state.document) {
      // Determine completeness from document sections
      const doc = state.document;
      const reqSection = doc.sections.get('requirements');
      const goalSection = doc.sections.get('goals');
      const hasRequirements = reqSection?.present && (reqSection.items.length > 0);
      const hasGoals = goalSection?.present && (goalSection.items.length > 0);

      if (!hasRequirements && !hasGoals) {
        // Spec file exists but is essentially empty
        health = 'yellow';
      } else {
        // Has content — default to green (spec ready, code may lag behind)
        // TODO: integrate with sync service for red/blue detection
        health = 'green';
      }
    }

    this.postToWebview({
      type: 'specHealth',
      payload: { health },
    });
  }

  /**
   * Send available models and current selection to the webview.
   */
  private async sendModelList(): Promise<void> {
    const catalogService = getModelCatalogService();
    const configService = getConfigurationService();
    const endpoint = configService.getActiveEndpoint();

    const catalog = await catalogService.getAvailableCatalog();
    const models = catalog.map(e => ({
      modelId: e.modelId,
      displayName: e.displayName,
      provider: e.provider,
    }));

    const selectedModel = endpoint
      ? catalogService.getSelectedModelId(endpoint)
      : undefined;

    this.postToWebview({
      type: 'modelList',
      payload: { models, selectedModel },
    });
  }

  /**
   * Handle model selection from the webview dropdown.
   */
  private async handleSelectModel(modelId: string): Promise<void> {
    const catalogService = getModelCatalogService();
    const configService = getConfigurationService();
    const endpoint = configService.getActiveEndpoint();
    if (!endpoint) return;

    const entry = catalogService.findModel(modelId);
    if (!entry) return;

    await catalogService.selectModelEntry(entry, endpoint);
    // Refresh endpoint status so the UI updates
    await getAgentService().sendEndpointStatus();
    // Refresh model list (endpoint may have changed)
    await this.sendModelList();
  }

  /**
   * Run a command in the VS Code integrated terminal.
   * Reuses an existing RQML terminal if still open.
   */
  private runInTerminal(command: string): void {
    // Check if existing terminal is still alive
    if (this.terminal && this.terminal.exitStatus === undefined) {
      this.terminal.show(true);
      this.terminal.sendText(command);
    } else {
      this.terminal = vscode.window.createTerminal({ name: 'RQML' });
      this.terminal.show(true);
      this.terminal.sendText(command);
    }
  }

  /**
   * List files and folders in a workspace-relative directory for the file browser.
   */
  private async listWorkspaceFiles(relativePath: string): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      this.postToWebview({ type: 'workspaceFiles', payload: { entries: [], relativePath } });
      return;
    }

    const root = folders[0].uri;
    const targetUri = relativePath ? vscode.Uri.joinPath(root, relativePath) : root;

    try {
      const rawEntries = await vscode.workspace.fs.readDirectory(targetUri);
      // Sort: folders first, then files, both alphabetical; hide dot-prefixed entries
      const entries = rawEntries
        .filter(([name]) => !name.startsWith('.'))
        .sort((a, b) => {
          if (a[1] !== b[1]) {
            return a[1] === vscode.FileType.Directory ? -1 : 1;
          }
          return a[0].localeCompare(b[0]);
        })
        .map(([name, type]) => ({
          name,
          isDirectory: type === vscode.FileType.Directory,
          path: relativePath ? `${relativePath}/${name}` : name,
        }));

      this.postToWebview({ type: 'workspaceFiles', payload: { entries, relativePath } });
    } catch {
      this.postToWebview({ type: 'workspaceFiles', payload: { entries: [], relativePath } });
    }
  }

  /**
   * Read file contents for attached paths (used when submitting a prompt with attachments).
   * For directories, collects files recursively up to a depth limit.
   */
  private async readFileContents(paths: string[]): Promise<Array<{ path: string; content: string }>> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return [];

    const root = folders[0].uri;
    const files: Array<{ path: string; content: string }> = [];

    for (const relPath of paths) {
      const uri = vscode.Uri.joinPath(root, relPath);
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          await this.collectDirectoryFiles(root, relPath, files, 3);
        } else {
          const bytes = await vscode.workspace.fs.readFile(uri);
          const content = Buffer.from(bytes).toString('utf-8');
          if (content.length <= 100_000) {
            files.push({ path: relPath, content });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return files;
  }

  private async collectDirectoryFiles(
    root: vscode.Uri,
    relDir: string,
    out: Array<{ path: string; content: string }>,
    maxDepth: number
  ): Promise<void> {
    if (maxDepth <= 0) return;
    const dirUri = vscode.Uri.joinPath(root, relDir);
    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      for (const [name, type] of entries) {
        if (name.startsWith('.') || name === 'node_modules') continue;
        const childPath = `${relDir}/${name}`;
        if (type === vscode.FileType.Directory) {
          await this.collectDirectoryFiles(root, childPath, out, maxDepth - 1);
        } else {
          try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root, childPath));
            const content = Buffer.from(bytes).toString('utf-8');
            if (content.length <= 100_000) {
              out.push({ path: childPath, content });
            }
          } catch { /* skip unreadable files */ }
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  /**
   * REQ-CMD-003: Navigate to a requirement by ID in the spec file
   */
  private async navigateToRequirement(id: string): Promise<void> {
    const specService = getSpecService();
    const state = specService.state;
    if (!state.document?.uri) return;

    // Find the line number for this ID by searching the document text
    try {
      const textDoc = await vscode.workspace.openTextDocument(state.document.uri);
      const text = textDoc.getText();
      // Search for id="<id>" pattern in the XML
      const pattern = new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`);
      const match = pattern.exec(text);

      if (match) {
        const pos = textDoc.positionAt(match.index);
        const range = new vscode.Range(pos, pos);
        await vscode.window.showTextDocument(textDoc, {
          selection: range,
          preserveFocus: false,
        });
      } else {
        // Fallback: just open the file
        await vscode.window.showTextDocument(textDoc);
      }
    } catch {
      // Silently fail if we can't navigate
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
