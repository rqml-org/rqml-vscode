// REQ-AGT-001 through REQ-AGT-014: RQML Agent Service
// REQ-CMD-001: Slash command dispatch
// Core service managing conversations, LLM calls, monitoring, and change proposals.

import * as vscode from 'vscode';
import * as fs from 'fs';
import { streamText, type ModelMessage } from 'ai';
import { getLlmService } from './llmService';
import { getSpecService } from './specService';
import { getConfigurationService } from './configurationService';
import { getDiagnosticsService } from './diagnosticsService';
import type { StrictnessLevel } from '../types/configuration';
import { createCommandRegistry, type CommandRegistry, type CommandContext } from '../commands/slashCommands';
import { getXsdPath, isXsdAvailable } from './xsdVersions';

/** Message sent to the webview */
export interface AgentWebviewMessage {
  type: string;
  payload: unknown;
}

/** A proposed change to the RQML spec */
interface ProposedChange {
  changeId: string;
  description: string;
  diff: string;
  /** The new full content to write to the RQML file */
  newContent: string;
}

/**
 * AgentService - Manages the RQML Agent lifecycle.
 * REQ-AGT-004, REQ-AGT-005: Monitors file changes
 * REQ-AGT-006: Quality assessment
 * REQ-AGT-007: Change suggestions
 * REQ-AGT-008: User-confirmed modifications
 * REQ-AGT-009: No code modification
 * REQ-AGT-010: Spec-code sync commentary
 * REQ-AGT-011: Software engineering principles
 * REQ-AGT-012: XSD schema conformance
 * REQ-AGT-013, REQ-AGT-014: Strictness levels
 */
export class AgentService {
  private _onDidReceiveMessage = new vscode.EventEmitter<AgentWebviewMessage>();
  readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

  private disposables: vscode.Disposable[] = [];
  private conversationHistory: ModelMessage[] = [];
  private pendingChanges = new Map<string, ProposedChange>();
  private autoApprove = false;
  private lastStreamContent = '';
  private extensionPath: string = '';
  private schemaContent: string | undefined;

  // REQ-CMD-001: Slash command registry
  private _commandRegistry: CommandRegistry | undefined;

  // REQ-AGT-004, REQ-AGT-005: File watchers
  private rqmlWatcher: vscode.FileSystemWatcher | undefined;
  private codeWatcher: vscode.FileSystemWatcher | undefined;

  // Debounce timers for file change events
  private rqmlChangeTimer: ReturnType<typeof setTimeout> | undefined;
  private codeChangeTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Initialize the agent service with extension context.
   */
  initialize(extensionPath: string): void {
    this.extensionPath = extensionPath;
    this._commandRegistry = createCommandRegistry();
    this.loadSchema();
    this.setupFileWatchers();

    // Reload schema when spec changes (version may differ)
    const specService = getSpecService();
    this.disposables.push(
      specService.onDidChangeSpec(() => this.loadSchema())
    );
  }

  /** REQ-CMD-001: Access the command registry (for autocomplete, palette integration) */
  get commandRegistry(): CommandRegistry {
    if (!this._commandRegistry) {
      this._commandRegistry = createCommandRegistry();
    }
    return this._commandRegistry;
  }

  /**
   * REQ-AGT-012 AC-AGT-012-02: Load XSD schema for agent's system prompt.
   * REQ-UI-011A: Version-aware — reads version from the loaded spec document.
   */
  private loadSchema(): void {
    if (!this.extensionPath) return;

    const specService = getSpecService();
    const version = specService.state.document?.version;
    if (!version) return;

    if (!isXsdAvailable(this.extensionPath, version)) {
      console.warn(`AgentService: XSD schema for version ${version} not found`);
      this.schemaContent = undefined;
      return;
    }

    try {
      const schemaPath = getXsdPath(this.extensionPath, version);
      this.schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    } catch {
      console.warn('AgentService: Failed to load XSD schema');
    }
  }

  /**
   * REQ-AGT-004, REQ-AGT-005: Set up file watchers
   */
  private setupFileWatchers(): void {
    // REQ-AGT-004: Watch RQML files
    this.rqmlWatcher = vscode.workspace.createFileSystemWatcher('**/*.rqml');
    this.rqmlWatcher.onDidChange(() => this.onRqmlFileChanged());
    this.disposables.push(this.rqmlWatcher);

    // REQ-AGT-005: Watch source code files
    this.codeWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{ts,tsx,js,jsx,py,java,go,rs,c,cpp,h,hpp,cs}'
    );
    this.codeWatcher.onDidChange(() => this.onCodeFileChanged());
    this.codeWatcher.onDidCreate(() => this.onCodeFileChanged());
    this.codeWatcher.onDidDelete(() => this.onCodeFileChanged());
    this.disposables.push(this.codeWatcher);
  }

  /**
   * REQ-AGT-004: React to RQML file changes
   */
  private onRqmlFileChanged(): void {
    if (this.rqmlChangeTimer) clearTimeout(this.rqmlChangeTimer);
    this.rqmlChangeTimer = setTimeout(async () => {
      const llmService = getLlmService();
      if (!(await llmService.isReady())) return;

      this._onDidReceiveMessage.fire({
        type: 'systemMessage',
        payload: { content: 'RQML spec file changed. Analysing...' }
      });

      await this.analyseSpecChange();
    }, 2000); // 2s debounce
  }

  /**
   * REQ-AGT-005: React to codebase changes
   */
  private onCodeFileChanged(): void {
    if (this.codeChangeTimer) clearTimeout(this.codeChangeTimer);
    this.codeChangeTimer = setTimeout(async () => {
      const llmService = getLlmService();
      if (!(await llmService.isReady())) return;

      this._onDidReceiveMessage.fire({
        type: 'systemMessage',
        payload: { content: 'Codebase change detected. Checking spec-code alignment...' }
      });

      await this.analyseCodeChange();
    }, 5000); // 5s debounce for code changes
  }

  /**
   * REQ-AGT-002, REQ-CMD-001: Handle user message from the prompt input.
   * Slash commands are intercepted before the LLM readiness check.
   */
  async handleUserMessage(text: string): Promise<void> {
    // REQ-CMD-001: Intercept slash commands before LLM check
    if (text.trimStart().startsWith('/')) {
      const parsed = this.commandRegistry.parse(text);
      if (parsed) {
        const ctx = this.buildCommandContext();
        await this.commandRegistry.execute(parsed, ctx);
        // Signal completion so the webview can clear spinner and show prompt
        this._onDidReceiveMessage.fire({ type: 'commandDone', payload: {} });
        return;
      }
    }

    const llmService = getLlmService();

    if (!(await llmService.isReady())) {
      this._onDidReceiveMessage.fire({
        type: 'agentResponse',
        payload: {
          id: crypto.randomUUID(),
          content: 'No LLM endpoint configured. Please use "RQML: Add LLM Endpoint" from the command palette to configure one.',
        }
      });
      return;
    }

    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: text });

    await this.streamResponse();
  }

  /**
   * Stream a response from the LLM, including system prompt with context
   */
  private async streamResponse(): Promise<void> {
    const llmService = getLlmService();
    const msgId = crypto.randomUUID();

    try {
      const model = await llmService.getModel();
      const systemPrompt = await this.buildSystemPrompt();

      const result = streamText({
        model,
        system: systemPrompt,
        messages: this.conversationHistory,
      });

      let fullContent = '';

      for await (const chunk of result.textStream) {
        fullContent += chunk;
        this._onDidReceiveMessage.fire({
          type: 'agentStreaming',
          payload: { id: msgId, content: fullContent }
        });
      }

      // Parse final response for change proposals
      const change = this.extractChangeProposal(fullContent);

      // Store for offerCopy
      this.lastStreamContent = fullContent;

      // Add to conversation history
      this.conversationHistory.push({ role: 'assistant', content: fullContent });

      // If auto-approve is on and there's a change, apply it immediately
      if (change && this.autoApprove) {
        this._onDidReceiveMessage.fire({
          type: 'agentStreamEnd',
          payload: { id: msgId, content: fullContent, change: { ...change, status: 'accepted' } }
        });
        await this.applyChangeInternal(change);
      } else {
        this._onDidReceiveMessage.fire({
          type: 'agentStreamEnd',
          payload: {
            id: msgId,
            content: fullContent,
            change: change ? { ...change, status: 'pending' } : undefined
          }
        });

        if (change) {
          this.pendingChanges.set(change.changeId, change);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._onDidReceiveMessage.fire({
        type: 'agentResponse',
        payload: { id: msgId, content: `Error communicating with LLM: ${message}` }
      });
    }
  }

  /**
   * REQ-AGT-006, REQ-AGT-010, REQ-AGT-011, REQ-AGT-012, REQ-AGT-013:
   * Build the system prompt with current spec, schema, and strictness context
   */
  private async buildSystemPrompt(): Promise<string> {
    const strictness = await this.resolveStrictness();
    const specContent = await this.getSpecContent();
    const agentsMd = await this.getAgentsMd();

    const parts: string[] = [];

    parts.push(`You are the RQML Agent, a requirements engineering assistant for VS Code.`);
    parts.push(`Your role is to help maintain and improve the RQML requirements specification.`);
    parts.push('');

    // REQ-AGT-009: No code modification constraint
    parts.push(`CRITICAL CONSTRAINT: You MUST NEVER propose changes to source code files. You operate EXCLUSIVELY on the RQML specification file (.rqml). You may comment on code-spec synchronisation but must not generate code changes.`);
    parts.push('');

    // REQ-AGT-013: Strictness level
    parts.push(`## Strictness Level: ${strictness}`);
    switch (strictness) {
      case 'relaxed':
        parts.push(`The spec is advisory. Quick iteration is allowed. Focus on major issues only. Ghost features are tolerated.`);
        break;
      case 'standard':
        parts.push(`Spec-first development for features. Core trace edges required. New features must be specified. Flag ghost features.`);
        break;
      case 'strict':
        parts.push(`Full traceability required. All behaviour must be specified. No ghost features allowed. Flag all unspecified behaviour.`);
        break;
      case 'certified':
        parts.push(`Audit-grade traceability with metadata. All specs must be formally approved before implementation. Require formal elicitation for all requirements.`);
        break;
    }
    parts.push('');

    // REQ-AGT-011: Software engineering principles
    parts.push(`## Software Engineering Principles`);
    parts.push(`- Every requirement must be atomic, testable, and uniquely identified`);
    parts.push(`- Use unambiguous language; avoid vague terms like "should support" without measurable criteria`);
    parts.push(`- Ensure proper traceability between goals, requirements, features, test cases, and design decisions`);
    parts.push(`- Flag violations when reviewing user-authored content`);
    parts.push('');

    // REQ-AGT-012 AC-AGT-012-02: Include XSD schema
    if (this.schemaContent) {
      parts.push(`## RQML XSD Schema`);
      parts.push(`All RQML content you produce MUST validate against this schema. Follow all guidance in schema comments.`);
      parts.push('```xml');
      parts.push(this.schemaContent);
      parts.push('```');
      parts.push('');
    }

    // AGENTS.md content if present
    if (agentsMd) {
      parts.push(`## Project AGENTS.md Guidelines`);
      parts.push(agentsMd);
      parts.push('');
    }

    // Current spec content
    if (specContent) {
      parts.push(`## Current RQML Specification`);
      parts.push('```xml');
      parts.push(specContent);
      parts.push('```');
      parts.push('');
    }

    // REQ-AGT-007: Change proposal format
    parts.push(`## Proposing Changes`);
    parts.push(`When you want to suggest a change to the RQML spec, include a change proposal block in your response using this exact format:`);
    parts.push('```');
    parts.push(`:::CHANGE_PROPOSAL:::`);
    parts.push(`DESCRIPTION: Brief description of the change`);
    parts.push(`DIFF: What is being added/modified/removed`);
    parts.push(`NEW_CONTENT:`);
    parts.push(`(the complete updated RQML file content)`);
    parts.push(`:::END_PROPOSAL:::`);
    parts.push('```');
    parts.push(`Only propose changes to the .rqml file. Never propose code changes.`);

    return parts.join('\n');
  }

  /**
   * REQ-AGT-014: Resolve the effective strictness level
   */
  private async resolveStrictness(): Promise<StrictnessLevel> {
    const configService = getConfigurationService();
    const settingsLevel = configService.getStrictnessSetting();

    // Settings override takes precedence
    if (settingsLevel) return settingsLevel;

    // Fall back to AGENTS.md
    const agentsMd = await this.getAgentsMd();
    if (agentsMd) {
      const match = agentsMd.match(/Strictness:\s*`(\w+)`/i);
      if (match) {
        const level = match[1].toLowerCase();
        if (['relaxed', 'standard', 'strict', 'certified'].includes(level)) {
          return level as StrictnessLevel;
        }
      }
    }

    // Default to standard
    return 'standard';
  }

  /**
   * Get the current RQML spec file content
   */
  private async getSpecContent(): Promise<string | undefined> {
    const specService = getSpecService();
    const state = specService.state;
    if (!state.document?.uri) return undefined;

    try {
      const bytes = await vscode.workspace.fs.readFile(state.document.uri);
      return Buffer.from(bytes).toString('utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * REQ-AGT-014: Read AGENTS.md from workspace root
   */
  private async getAgentsMd(): Promise<string | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;

    const agentsMdUri = vscode.Uri.joinPath(folders[0].uri, 'AGENTS.md');
    try {
      const bytes = await vscode.workspace.fs.readFile(agentsMdUri);
      return Buffer.from(bytes).toString('utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * REQ-AGT-007: Extract a change proposal from the LLM response
   */
  private extractChangeProposal(content: string): ProposedChange | undefined {
    const startMarker = ':::CHANGE_PROPOSAL:::';
    const endMarker = ':::END_PROPOSAL:::';

    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return undefined;

    const proposalBlock = content.substring(startIdx + startMarker.length, endIdx).trim();

    const descMatch = proposalBlock.match(/DESCRIPTION:\s*(.*?)(?:\n|$)/);
    const diffMatch = proposalBlock.match(/DIFF:\s*([\s\S]*?)(?=NEW_CONTENT:)/);
    const contentMatch = proposalBlock.match(/NEW_CONTENT:\s*([\s\S]*)/);

    if (!contentMatch) return undefined;

    return {
      changeId: crypto.randomUUID(),
      description: descMatch?.[1]?.trim() || 'Proposed change to RQML spec',
      diff: diffMatch?.[1]?.trim() || '',
      newContent: contentMatch[1].trim(),
    };
  }

  /**
   * REQ-AGT-008 AC-AGT-008-03: Apply an accepted change
   */
  async applyChange(changeId: string): Promise<void> {
    const change = this.pendingChanges.get(changeId);
    if (!change) {
      this._onDidReceiveMessage.fire({
        type: 'agentResponse',
        payload: { id: crypto.randomUUID(), content: 'Change proposal not found or already processed.' }
      });
      return;
    }

    await this.applyChangeInternal(change);
    this.pendingChanges.delete(changeId);

    this._onDidReceiveMessage.fire({
      type: 'changeApplied',
      payload: { changeId }
    });
  }

  /**
   * Internal: Write a change to the RQML spec file
   * REQ-AGT-009: Only modifies .rqml files
   */
  private async applyChangeInternal(change: ProposedChange): Promise<void> {
    const specService = getSpecService();
    const state = specService.state;
    if (!state.document?.uri) return;

    try {
      const content = Buffer.from(change.newContent, 'utf-8');
      await vscode.workspace.fs.writeFile(state.document.uri, content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._onDidReceiveMessage.fire({
        type: 'agentResponse',
        payload: { id: crypto.randomUUID(), content: `Failed to apply change: ${message}` }
      });
    }
  }

  /**
   * REQ-AGT-008 AC-AGT-008-02: Reject a change
   */
  rejectChange(changeId: string): void {
    this.pendingChanges.delete(changeId);
    this._onDidReceiveMessage.fire({
      type: 'changeRejected',
      payload: { changeId }
    });
  }

  /**
   * REQ-AGT-008 AC-AGT-008-04: Set auto-approve for session
   */
  setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }

  /**
   * REQ-AGT-006: Analyse spec changes and provide quality feedback
   */
  private async analyseSpecChange(): Promise<void> {
    this.conversationHistory.push({
      role: 'user',
      content: '[SYSTEM EVENT] The RQML specification file has been modified. Please analyse the updated specification for quality, completeness, and structural integrity. Provide a brief assessment.'
    });
    await this.streamResponse();
  }

  /**
   * REQ-AGT-010: Analyse code changes for spec-code alignment
   */
  private async analyseCodeChange(): Promise<void> {
    this.conversationHistory.push({
      role: 'user',
      content: '[SYSTEM EVENT] Source code files have been modified. Please comment on whether the changes appear aligned with the current RQML specification. Note any requirements that may be affected or any code that appears unspecified.'
    });
    await this.streamResponse();
  }

  /**
   * Send current endpoint status to the webview
   */
  async sendEndpointStatus(): Promise<void> {
    const configService = getConfigurationService();
    const endpoint = configService.getActiveEndpoint();
    const isReady = await getLlmService().isReady();

    let modelId: string | undefined;
    if (endpoint) {
      const { getModelCatalogService } = await import('./modelCatalogService.js');
      const catalogService = getModelCatalogService();
      modelId = catalogService.getSelectedModelId(endpoint);
    }

    this._onDidReceiveMessage.fire({
      type: 'endpointStatus',
      payload: {
        configured: isReady,
        name: endpoint?.name,
        provider: endpoint?.provider,
        model: modelId,
      }
    });
  }

  /**
   * REQ-CMD-001: Build a CommandContext for slash command execution
   */
  private buildCommandContext(): CommandContext {
    return {
      reply: (content: string) => {
        this._onDidReceiveMessage.fire({
          type: 'commandResponse',
          payload: { id: crypto.randomUUID(), content }
        });
      },
      system: (content: string) => {
        this._onDidReceiveMessage.fire({
          type: 'systemMessage',
          payload: { content }
        });
      },
      streamPrompt: async (prompt: string) => {
        this.conversationHistory.push({ role: 'user', content: prompt });
        await this.streamResponse();
      },
      offerCopy: () => {
        // Extract fenced code block content, or fall back to full response
        const content = this.lastStreamContent;
        const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
        const copyText = codeBlockMatch ? codeBlockMatch[1].trim() : content;
        this._onDidReceiveMessage.fire({
          type: 'showCopyLink',
          payload: { content: copyText },
        });
      },
      services: {
        spec: getSpecService(),
        diagnostics: getDiagnosticsService(),
        config: getConfigurationService(),
        llm: getLlmService(),
        agent: this,
      },
    };
  }

  /** REQ-CMD-005: Clear conversation history */
  clearConversation(): void {
    this.conversationHistory = [];
    this.pendingChanges.clear();
  }

  /** Whether the conversation has prior messages (used by /cmd to detect if /plan has run) */
  hasConversationHistory(): boolean {
    return this.conversationHistory.length > 0;
  }

  /** Fire a message to the webview (used by command handlers) */
  fireMessage(msg: AgentWebviewMessage): void {
    this._onDidReceiveMessage.fire(msg);
  }

  dispose(): void {
    this._onDidReceiveMessage.dispose();
    if (this.rqmlChangeTimer) clearTimeout(this.rqmlChangeTimer);
    if (this.codeChangeTimer) clearTimeout(this.codeChangeTimer);
    this.disposables.forEach(d => d.dispose());
  }
}

/** Singleton */
let agentServiceInstance: AgentService | undefined;

export function getAgentService(): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService();
  }
  return agentServiceInstance;
}
