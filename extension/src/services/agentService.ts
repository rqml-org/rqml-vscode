// REQ-AGT-001 through REQ-AGT-014: RQML Agent Service
// REQ-CMD-001: Slash command dispatch
// Core service managing conversations, LLM calls, monitoring, and change proposals.

import * as vscode from 'vscode';
import * as fs from 'fs';
import { streamText, stepCountIs, type ModelMessage, type ToolSet } from 'ai';
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

  // /implement tool approval state
  private pendingToolApprovals = new Map<string, { resolve: (approved: boolean) => void }>();
  private autoApproveTools = false;
  private approvalInProgress = false;
  private approvalQueue: Array<() => void> = [];

  // Abort controller for cancelling in-flight LLM streams
  private currentAbort: AbortController | undefined;

  // /implement askUser state
  private pendingUserChoices = new Map<string, { resolve: (choice: string) => void }>();
  // Gate: when askUser is pending, write tools (writeFile, updateSpec) must wait
  private userChoiceGate: Promise<void> | null = null;
  private userChoiceGateResolve: (() => void) | null = null;

  // Suppress file-watcher analysis while a tool stream (/implement) is running
  private toolStreamActive = false;

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
      if (this.toolStreamActive) { return; } // Suppress during /implement
      await this.backgroundAnalysis(
        '[SYSTEM EVENT] The RQML specification file has been modified. Assess whether this change is material — does it affect requirements coverage, traceability, or spec-code alignment? If the change is trivial (whitespace, formatting, minor wording), respond with exactly "[NO_CHANGE]". Otherwise, provide a brief assessment of the impact.'
      );
    }, 2000); // 2s debounce
  }

  /**
   * REQ-AGT-005: React to codebase changes
   */
  private onCodeFileChanged(): void {
    if (this.codeChangeTimer) clearTimeout(this.codeChangeTimer);
    this.codeChangeTimer = setTimeout(async () => {
      if (this.toolStreamActive) { return; } // Suppress during /implement
      await this.backgroundAnalysis(
        '[SYSTEM EVENT] Source code files have been modified. Assess whether the changes are material to spec-code alignment — are there new unspecified features, removed implementations, or requirement coverage changes? If the changes are routine (dependency updates, formatting, non-functional) or you cannot determine the impact without more context, respond with exactly "[NO_CHANGE]". Otherwise, briefly note what may be affected.'
      );
    }, 5000); // 5s debounce for code changes
  }

  /**
   * REQ-AGT-002, REQ-CMD-001: Handle user message from the prompt input.
   * Slash commands are intercepted before the LLM readiness check.
   */
  async handleUserMessage(
    text: string,
    images?: Array<{ dataUrl: string; mediaType: string }>
  ): Promise<void> {
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

    // Build user content — multi-part when images are present
    let content: ModelMessage['content'];
    if (images && images.length > 0) {
      const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mediaType: string }> = [];
      if (text) {
        parts.push({ type: 'text', text });
      }
      for (const img of images) {
        // Strip data URL prefix to get raw base64 for the AI SDK
        const base64 = img.dataUrl.replace(/^data:[^;]+;base64,/, '');
        parts.push({ type: 'image', image: base64, mediaType: img.mediaType });
      }
      content = parts;
    } else {
      content = text;
    }

    this.conversationHistory.push({ role: 'user', content });

    await this.streamResponse();
  }

  /**
   * Abort the current LLM stream, if any.
   */
  stopGeneration(): void {
    if (this.currentAbort) {
      this.currentAbort.abort();
      this.currentAbort = undefined;
    }
  }

  /**
   * Stream a response from the LLM, including system prompt with context.
   * All tools are available in regular chat — slash commands are shortcuts, not gates.
   */
  private async streamResponse(): Promise<void> {
    const llmService = getLlmService();
    let currentMsgId = crypto.randomUUID();

    try {
      const model = await llmService.getModel();
      const systemPrompt = await this.buildSystemPrompt();

      // Provide tools if a workspace is open
      const folders = vscode.workspace.workspaceFolders;
      let tools: ToolSet | undefined;
      if (folders?.length) {
        const { createImplementTools } = await import('./implementTools.js');
        tools = createImplementTools(folders[0].uri.fsPath, this);
      }

      this.currentAbort = new AbortController();

      const result = streamText({
        model,
        system: systemPrompt,
        messages: this.conversationHistory,
        abortSignal: this.currentAbort.signal,
        ...(tools ? { tools, stopWhen: stepCountIs(15) } : {}),
      });

      // Each step's text gets its own message ID. When a tool call occurs,
      // the current text is finalized and a new ID is created so the next
      // step's text appears below the tool call messages in the chat.
      let stepContent = '';
      // When askUser is called, suppress subsequent text and tool messages
      // until the next step begins (i.e. the user has responded and tool
      // execution completed).
      let askUserPending = false;

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta': {
            if (askUserPending) { break; } // Suppress text while waiting for user choice
            stepContent += part.text;
            this._onDidReceiveMessage.fire({
              type: 'agentStreaming',
              payload: { id: currentMsgId, content: this.stripProposalForDisplay(stepContent) },
            });
            break;
          }
          case 'tool-call': {
            // Finalize any accumulated text (or clean up empty placeholder)
            // and always rotate the message ID so the next text segment
            // appears below the tool-call system messages.
            if (!askUserPending) {
              this._onDidReceiveMessage.fire({
                type: 'agentStreamEnd',
                payload: { id: currentMsgId, content: stepContent ? this.stripProposalForDisplay(stepContent) : '' },
              });
              stepContent = '';
              currentMsgId = crypto.randomUUID();
            }
            if (part.toolName === 'askUser') {
              // askUser card is the UI — suppress subsequent messages until step completes
              askUserPending = true;
            } else if (!askUserPending) {
              const input = part.input as Record<string, unknown>;
              this._onDidReceiveMessage.fire({
                type: 'systemMessage',
                payload: {
                  content: `Calling tool: **${part.toolName}**(${
                    (input.path as string) ?? (input.pattern as string) ?? (input.question as string) ?? ''
                  })`,
                },
              });
            }
            break;
          }
          case 'tool-result':
          case 'finish-step':
          case 'start-step':
            // Step boundary or tool completion — resume normal output
            askUserPending = false;
            break;
        }
      }

      // The final step's text is in stepContent — extract change proposals from it
      const change = this.extractChangeProposal(stepContent);
      let displayContent = this.stripProposalForDisplay(stepContent);

      // Detect raw askUser JSON that models sometimes output as plain text
      displayContent = this.interceptRawAskUser(displayContent);

      // Store for offerCopy
      this.lastStreamContent = stepContent;

      // Add proper response messages to conversation history (preserves tool calls/results)
      const response = await result.response;
      this.conversationHistory.push(...response.messages);

      // Finalize the streaming message with the final step's content
      if (change && this.autoApprove) {
        this._onDidReceiveMessage.fire({
          type: 'agentStreamEnd',
          payload: { id: currentMsgId, content: displayContent, change: { ...change, status: 'accepted' } }
        });
        await this.applyChangeInternal(change);
      } else {
        this._onDidReceiveMessage.fire({
          type: 'agentStreamEnd',
          payload: {
            id: currentMsgId,
            content: displayContent,
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
        payload: { id: currentMsgId, content: `Error communicating with LLM: ${message}` }
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

    parts.push('You are the RQML Agent, a spec-first requirements engineering assistant for VS Code.');
    parts.push('You enforce the RQML development process: all features must be specified before implementation.');
    parts.push('The RQML spec and all implementation code reside in the same repository.');
    parts.push('If the workspace contains only a spec file and no source code, implementation has not yet begun.');
    parts.push('You personality is encourraging and collagorative and you love to build software with the user.');
    parts.push('You always provide the user with a clear path forward, whether it is updating the spec or implementing the next stage in the plan.');

    // REQ-AGT-009: Tools available in chat
    parts.push('## Tools');
    parts.push('You have the following tools available:');
    parts.push('- **readFile**: Read a file in the workspace');
    parts.push('- **writeFile**: Write/create a file (requires user approval)');
    parts.push('- **listFiles**: List files matching a glob pattern');
    parts.push('- **readSpec**: Read the current RQML spec');
    parts.push('- **updateSpec**: Update the RQML spec (requires user approval)');
    parts.push('- **askUser**: Present the user with a question and clickable options');
    parts.push('');
    parts.push('CRITICAL: When you need user input, confirmation, or want to present choices, you MUST call the askUser tool. NEVER write options as plain text in your response — the user cannot respond to plain-text options. The askUser tool renders interactive buttons the user can click.');
    parts.push('For RQML spec changes you may also use the change proposal format (:::CHANGE_PROPOSAL:::).');
    parts.push('');
    parts.push('## Diagrams');
    parts.push('You can render architecture diagrams, flowcharts, sequence diagrams, and other visuals using Mermaid.js.');
    parts.push('Use ```mermaid code fences in your response — they render as interactive SVG diagrams directly in the chat.');
    parts.push('Do NOT tell the user to paste the diagram elsewhere or use an external renderer. The diagrams render inline automatically.');
    parts.push('Mermaid syntax rules (IMPORTANT — invalid syntax breaks the diagram):');
    parts.push('- Node labels with special characters (spaces, slashes, parens) MUST use quotes: `A["Web / CLI"]` not `A[Web / CLI]`');
    parts.push('- For line breaks in labels use `<br/>` inside quotes: `A["Line 1<br/>Line 2"]` — never use `\\n`');
    parts.push('- Subgraph titles with special characters need quotes: `subgraph Delivery["Delivery / Interface Layer"]`');
    parts.push('- Avoid bare parentheses in labels — use quotes or rephrase');
    parts.push('');

    // Development process — intrinsic, not overridable by AGENTS.md
    parts.push('## Development Process: Spec → Design → Plan → Code');
    parts.push('You enforce this process. Always nudge the user towards this workflow:');
    parts.push('');
    parts.push('1. **Spec** (`/elicit`) — Gather and document requirements in the RQML spec');
    parts.push('2. **Design** (`/design`) — Make and record architectural decisions as ADRs in `.rqml/adr/`');
    parts.push('3. **Plan** (`/plan`) — Create a staged implementation plan from spec + design + codebase');
    parts.push('4. **Code** (`/cmd` to generate prompts, `/implement` to run agentic coding)');
    parts.push('5. **Verify** (`/sync`, `/validate`, `/lint`, `/score`) — Check spec↔code sync, validate, and lint');
    parts.push('');
    parts.push('When the user asks to build something without requirements in the spec, direct them to `/elicit`.');
    parts.push('When the user jumps to planning or coding without design decisions for significant architectural choices, suggest `/design new`.');
    parts.push('Enforcement varies by strictness: at `relaxed` suggest the process; at `certified` require it.');
    parts.push('');

    // Plan management — the agent owns the plan file implicitly
    parts.push('## Plan Management');
    parts.push('You maintain the implementation plan file (`.rqml/plan.md`) implicitly.');
    parts.push('When the user asks to implement something:');
    parts.push('- If a plan exists (shown in the Implementation Plan section below), use it to determine the next unfinished stage and proceed.');
    parts.push('- If NO plan exists, generate one using the writeFile tool (path: `.rqml/plan.md`), then proceed with the first stage.');
    parts.push('Never ask the user whether to create a plan or whether a plan exists. Just find it or create it and move forward.');
    parts.push('After completing a stage, update the plan file to mark that stage as complete (change `- [ ]` to `- [x]`).');
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

    // AGENTS.md content if present — supplementary, does not override core process
    if (agentsMd) {
      parts.push('## Project Guidelines (AGENTS.md)');
      parts.push('The following are project-specific guidelines. They supplement but do not override the core RQML development process above.');
      parts.push(agentsMd);
      parts.push('');
    }

    // Include ADR summaries if any exist
    const adrSummary = await this.readAdrSummary();
    if (adrSummary) {
      parts.push('## Architecture Decision Records');
      parts.push('Current ADRs from `.rqml/adr/`:');
      parts.push(adrSummary);
      parts.push('');
    }

    // Include persistent plan file if available
    const planContent = await this.readPlanFile();
    if (planContent) {
      parts.push('## Implementation Plan');
      parts.push('Current plan from `.rqml/plan.md`:');
      parts.push(planContent);
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
    parts.push(`Use the change proposal format for RQML spec changes. For code changes, use the writeFile tool.`);

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
   * Strip :::CHANGE_PROPOSAL::: blocks from displayed content.
   * During streaming (incomplete proposal): replaces with a placeholder.
   * After streaming (complete proposal): strips entirely (shown as card).
   */
  private stripProposalForDisplay(content: string): string {
    const startMarker = ':::CHANGE_PROPOSAL:::';
    const endMarker = ':::END_PROPOSAL:::';

    const startIdx = content.indexOf(startMarker);
    if (startIdx === -1) return content;

    const before = content.substring(0, startIdx).trimEnd();
    const endIdx = content.indexOf(endMarker);

    if (endIdx === -1) {
      // Proposal started but not ended (during streaming)
      return before + '\n\n*Preparing change proposal...*';
    }

    // Complete proposal — strip entirely (will be shown as a card)
    const after = content.substring(endIdx + endMarker.length).trimStart();
    return after ? before + '\n\n' + after : before;
  }

  /**
   * Detect raw askUser tool call JSON that some models output as plain text
   * instead of using function calling. Intercepts the first occurrence,
   * fires a userChoiceRequest, and returns the text with all raw askUser
   * JSON blocks stripped out.
   */
  private interceptRawAskUser(content: string): string {
    // Find raw askUser JSON blocks that some models output as plain text
    const marker = '"name"';
    let result = content;
    let intercepted = false;

    // Scan for {"name": "askUser", "arguments": ...} blocks
    let searchFrom = 0;
    while (true) {
      const idx = result.indexOf(marker, searchFrom);
      if (idx === -1) break;

      // Walk back to find the opening {
      let braceStart = idx - 1;
      while (braceStart >= 0 && result[braceStart] !== '{') {
        braceStart--;
      }
      if (braceStart < 0) {
        searchFrom = idx + 1;
        continue;
      }

      // Try to parse the JSON starting from braceStart by finding balanced braces
      let depth = 0;
      let braceEnd = -1;
      for (let i = braceStart; i < result.length; i++) {
        if (result[i] === '{') {
          depth++;
        } else if (result[i] === '}') {
          depth--;
          if (depth === 0) {
            braceEnd = i;
            break;
          }
        }
      }
      if (braceEnd === -1) {
        searchFrom = idx + 1;
        continue;
      }

      const jsonStr = result.substring(braceStart, braceEnd + 1);
      try {
        const parsed = JSON.parse(jsonStr) as {
          name?: string;
          arguments?: { question?: string; options?: string[]; recommended?: number };
        };
        if (parsed.name === 'askUser' && parsed.arguments?.question && Array.isArray(parsed.arguments.options)) {
          // Strip this JSON block from the output
          result = result.substring(0, braceStart) + result.substring(braceEnd + 1);

          // Only intercept the first one — fire user choice
          if (!intercepted) {
            intercepted = true;
            const { question, options, recommended } = parsed.arguments;
            const choiceId = crypto.randomUUID();
            this.waitForUserChoice(choiceId, question, options, recommended)
              .then(selected => {
                this.conversationHistory.push({ role: 'user', content: selected });
                this.streamResponse();
              })
              .catch(() => { /* user choice was cancelled or errored */ });
          }
          // Don't advance searchFrom — text shifted, re-scan from same position
          continue;
        }
      } catch {
        // Not valid JSON — skip
      }
      searchFrom = idx + 1;
    }

    return result;
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
   * REQ-AGT-004, REQ-AGT-005, REQ-AGT-006, REQ-AGT-010:
   * Run a background analysis without streaming to the chat.
   * Only displays the result if the LLM deems the change material.
   */
  private async backgroundAnalysis(prompt: string): Promise<void> {
    const llmService = getLlmService();
    if (!(await llmService.isReady())) { return; }

    try {
      const model = await llmService.getModel();
      const systemPrompt = await this.buildSystemPrompt();

      // Use a temporary history so background checks don't pollute conversation
      const messages: ModelMessage[] = [
        ...this.conversationHistory,
        { role: 'user', content: prompt },
      ];

      const result = streamText({
        model,
        system: systemPrompt,
        messages,
      });

      // Collect the full response without streaming to the UI
      let fullText = '';
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text;
        }
      }

      const trimmed = fullText.trim();

      // If the LLM says nothing material, silently discard
      if (!trimmed || trimmed === '[NO_CHANGE]' || trimmed.startsWith('[NO_CHANGE]')) {
        return;
      }

      // Material change — add to conversation history and display
      this.conversationHistory.push({ role: 'user', content: prompt });
      this.conversationHistory.push({ role: 'assistant', content: trimmed });

      const msgId = crypto.randomUUID();
      this._onDidReceiveMessage.fire({
        type: 'agentResponse',
        payload: { id: msgId, content: trimmed },
      });
    } catch {
      // Silently fail for background analysis
    }
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
   * Build a startup status summary for the webview welcome screen.
   */
  async getStartupStatus(): Promise<{ summary: string; nextStep: string; specLoaded: boolean }> {
    const specService = getSpecService();
    const specState = specService.state;
    const specLoaded = !!specState.document;
    const planContent = await this.readPlanFile();
    const llmReady = await getLlmService().isReady();

    // Build summary parts
    const parts: string[] = [];
    if (specLoaded) {
      parts.push('Spec loaded');
    } else {
      parts.push('No spec file loaded');
    }
    if (planContent) {
      parts.push('plan available');
    }
    if (llmReady) {
      parts.push('LLM ready');
    } else {
      parts.push('no LLM configured');
    }
    const summary = parts.join(' · ');

    // Determine recommended next step
    let nextStep: string;
    if (!specLoaded) {
      nextStep = 'Open an RQML spec file to get started.';
    } else if (!llmReady) {
      nextStep = 'Configure an LLM endpoint to start working with the agent.';
    } else if (!planContent) {
      nextStep = 'Ask me to implement something — I will generate a plan automatically.';
    } else {
      nextStep = 'Type /plan to review progress, or ask me to implement the next stage.';
    }

    return { summary, nextStep, specLoaded };
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

  // ─── /implement: Tool approval & agentic loop ───────────────────────

  /** Enable/disable auto-approve for tool calls in /implement */
  setAutoApproveTools(enabled: boolean): void {
    this.autoApproveTools = enabled;
  }

  /**
   * Wait for user approval of a tool call. If auto-approve is on, resolves immediately.
   * Otherwise sends a toolApprovalRequest to the webview and returns a Promise.
   */
  async waitForToolApproval(
    approvalId: string,
    toolName: string,
    args: Record<string, string>
  ): Promise<boolean> {
    // If an askUser choice is pending, wait for the user to respond first.
    // The LLM may call askUser + writeFile in the same step; we must not
    // write files before the user has answered.
    if (this.userChoiceGate) {
      await this.userChoiceGate;
    }

    // Serialize approvals: wait in queue if another approval is in progress.
    // This prevents multiple approval cards from appearing simultaneously
    // when the LLM emits several tool calls in one step.
    if (this.approvalInProgress) {
      await new Promise<void>(resolve => {
        this.approvalQueue.push(resolve);
      });
    }
    this.approvalInProgress = true;

    // Check auto-approve (may have been set by "Allow All" on a previous approval)
    if (this.autoApproveTools) {
      this._onDidReceiveMessage.fire({
        type: 'toolApprovalResolved',
        payload: { approvalId, approved: true },
      });
      this.releaseApprovalQueue();
      return true;
    }

    // Send request to webview
    this._onDidReceiveMessage.fire({
      type: 'toolApprovalRequest',
      payload: {
        approvalId,
        toolName,
        filePath: args.path ?? args.description ?? undefined,
        preview: args.preview ?? undefined,
      },
    });

    // Wait for user response
    const approved = await new Promise<boolean>((resolve) => {
      this.pendingToolApprovals.set(approvalId, { resolve });
    });

    this.releaseApprovalQueue();
    return approved;
  }

  private releaseApprovalQueue(): void {
    this.approvalInProgress = false;
    const next = this.approvalQueue.shift();
    if (next) {
      next();
    }
  }

  /** Resolve a pending tool approval (called from AgentViewProvider) */
  resolveToolApproval(approvalId: string, approved: boolean): void {
    const pending = this.pendingToolApprovals.get(approvalId);
    if (pending) {
      pending.resolve(approved);
      this.pendingToolApprovals.delete(approvalId);
    }
    // Notify webview of resolution
    this._onDidReceiveMessage.fire({
      type: 'toolApprovalResolved',
      payload: { approvalId, approved },
    });
  }

  /**
   * Wait for the user to choose from a set of options (used by askUser tool).
   * Sends a userChoiceRequest to the webview and returns the selected option.
   */
  async waitForUserChoice(
    choiceId: string,
    question: string,
    options: string[],
    recommended?: number
  ): Promise<string> {
    // Set the gate — write tools in the same step will wait until user responds
    this.userChoiceGate = new Promise<void>((resolve) => {
      this.userChoiceGateResolve = resolve;
    });

    this._onDidReceiveMessage.fire({
      type: 'userChoiceRequest',
      payload: { choiceId, question, options, recommended },
    });

    const selected = await new Promise<string>((resolve) => {
      this.pendingUserChoices.set(choiceId, { resolve });
    });

    // Release the gate — queued write tools can now proceed
    if (this.userChoiceGateResolve) {
      this.userChoiceGateResolve();
      this.userChoiceGate = null;
      this.userChoiceGateResolve = null;
    }

    return selected;
  }

  /** Resolve a pending user choice (called from AgentViewProvider) */
  resolveUserChoice(choiceId: string, selected: string): void {
    const pending = this.pendingUserChoices.get(choiceId);
    if (pending) {
      pending.resolve(selected);
      this.pendingUserChoices.delete(choiceId);
    }
  }

  /**
   * Run the /implement agentic loop with tool use.
   * Uses streamText with tools and maxSteps for multi-step implementation.
   */
  async runToolStream(target?: string): Promise<void> {
    const llmService = getLlmService();
    const msgId = crypto.randomUUID();

    this.toolStreamActive = true;
    try {
      const model = await llmService.getModel();
      const systemPrompt = await this.buildImplementPrompt(target);

      // Add user message to history
      const userMsg = target
        ? `[SYSTEM] Run /implement for: ${target}`
        : '[SYSTEM] Run /implement for the next unimplemented stage';
      this.conversationHistory.push({ role: 'user', content: userMsg });

      // Get workspace root for tools
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) {
        this._onDidReceiveMessage.fire({
          type: 'agentResponse',
          payload: { id: msgId, content: 'No workspace folder open. Cannot run /implement.' },
        });
        return;
      }
      const workspaceRoot = folders[0].uri.fsPath;

      // Create tools
      const { createImplementTools } = await import('./implementTools.js');
      const tools = createImplementTools(workspaceRoot, this);

      this.currentAbort = new AbortController();

      const result = streamText({
        model,
        system: systemPrompt,
        messages: this.conversationHistory,
        tools,
        stopWhen: stepCountIs(15),
        abortSignal: this.currentAbort.signal,
      });

      // Each text segment gets its own message ID so tool-call system messages
      // don't appear out of order. When the LLM transitions from text → tools,
      // we finalize the current text message and create a fresh ID for the next one.
      let currentMsgId = msgId;
      let stepContent = '';
      // Suppress tool-call messages after askUser within the same step
      let suppressToolMessages = false;

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta': {
            if (suppressToolMessages) { break; } // Suppress text while askUser is pending
            stepContent += part.text;
            this._onDidReceiveMessage.fire({
              type: 'agentStreaming',
              payload: { id: currentMsgId, content: this.stripProposalForDisplay(stepContent) },
            });
            break;
          }
          case 'tool-call': {
            // Finalize any preceding text (or clean up empty placeholder)
            // and always rotate the message ID so the next text segment
            // appears below the tool-call system messages.
            if (!suppressToolMessages) {
              this._onDidReceiveMessage.fire({
                type: 'agentStreamEnd',
                payload: { id: currentMsgId, content: stepContent ? this.stripProposalForDisplay(stepContent) : '' },
              });
              stepContent = '';
              currentMsgId = crypto.randomUUID();
            }
            if (part.toolName === 'askUser') {
              // askUser card is the UI — suppress subsequent messages until step completes
              suppressToolMessages = true;
            } else if (!suppressToolMessages) {
              const input = part.input as Record<string, unknown>;
              this._onDidReceiveMessage.fire({
                type: 'systemMessage',
                payload: {
                  content: `Calling tool: **${part.toolName}**(${
                    (input.path as string) ?? (input.pattern as string) ?? ''
                  })`,
                },
              });
            }
            break;
          }
          case 'tool-result':
          case 'start-step':
          case 'finish-step':
            // Step boundary or tool completion — resume normal output
            suppressToolMessages = false;
            break;
        }
      }

      // Add proper response messages to conversation history (preserves tool calls/results)
      const response = await result.response;
      this.conversationHistory.push(...response.messages);

      // Finalize the last text segment (or send empty to signal completion)
      let finalContent = this.stripProposalForDisplay(stepContent);
      finalContent = this.interceptRawAskUser(finalContent);
      this._onDidReceiveMessage.fire({
        type: 'agentStreamEnd',
        payload: { id: currentMsgId, content: finalContent },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._onDidReceiveMessage.fire({
        type: 'agentResponse',
        payload: { id: msgId, content: `Error during /implement: ${message}` },
      });
    } finally {
      this.toolStreamActive = false;
    }
  }

  /**
   * Build the system prompt for /implement — allows code changes via tools.
   * Shares context (spec, schema, AGENTS.md, strictness) with buildSystemPrompt()
   * but replaces the "no code modification" constraint with tool-use instructions.
   */
  private async buildImplementPrompt(target?: string): Promise<string> {
    const strictness = await this.resolveStrictness();
    const specContent = await this.getSpecContent();
    const agentsMd = await this.getAgentsMd();

    const parts: string[] = [];

    parts.push('You are the RQML Implementation Agent for VS Code.');
    parts.push('Your role is to implement code based on the RQML requirements specification, one stage at a time.');
    parts.push('');

    parts.push('## Available Tools');
    parts.push('You have the following tools:');
    parts.push('- **readFile**: Read a file from the workspace (auto-executed)');
    parts.push('- **writeFile**: Write/create a file in the workspace (requires user approval)');
    parts.push('- **listFiles**: List files matching a glob pattern (auto-executed)');
    parts.push('- **readSpec**: Read the current RQML spec (auto-executed)');
    parts.push('- **updateSpec**: Update the RQML spec file (requires user approval)');
    parts.push('- **askUser**: Present the user with a question and clickable options (ALWAYS use this instead of asking questions in plain text)');
    parts.push('');

    parts.push('## Implementation Guidelines');
    parts.push('1. Implement ONE stage at a time. Do not try to implement everything at once.');
    parts.push('2. Before writing code, read existing files to understand the codebase structure.');
    parts.push('3. After implementing code, use updateSpec to:');
    parts.push('   - Add trace edges linking requirements to the new source files');
    parts.push('   - Update requirement statuses where appropriate');
    parts.push('4. Write clean, idiomatic code that follows existing project conventions.');
    parts.push('5. Include any necessary imports and dependencies.');
    if (target) {
      parts.push(`6. Focus specifically on: ${target}`);
    } else {
      parts.push('6. Determine the next unimplemented stage from the plan and implement it.');
    }
    parts.push('7. IMPORTANT: When you need user input or confirmation, ALWAYS use the askUser tool. Never ask questions in plain text.');
    parts.push('');

    // Process context
    parts.push('## Process Context');
    parts.push('This is step 4 (Implement) in the RQML development process.');
    parts.push('If no plan is provided below, generate a staged plan and save it to `.rqml/plan.md` using the writeFile tool, then implement the first stage.');
    parts.push('');

    // Include ADR summaries if any exist
    const adrSummary = await this.readAdrSummary();
    if (adrSummary) {
      parts.push('## Architecture Decision Records');
      parts.push('Respect these design decisions during implementation:');
      parts.push(adrSummary);
      parts.push('');
    }

    // Include persistent plan file if available
    const planContent = await this.readPlanFile();
    if (planContent) {
      parts.push('## Implementation Plan');
      parts.push('Current plan from `.rqml/plan.md`:');
      parts.push(planContent);
      parts.push('');
    }

    // Strictness level
    parts.push(`## Strictness Level: ${strictness}`);
    switch (strictness) {
      case 'relaxed':
        parts.push('Quick iteration is allowed. Focus on getting the implementation working.');
        break;
      case 'standard':
        parts.push('Spec-first development. Ensure trace edges are added for all implemented requirements.');
        break;
      case 'strict':
        parts.push('Full traceability required. Every implemented feature must be traced back to requirements.');
        break;
      case 'certified':
        parts.push('Audit-grade traceability. Every file change must be justified by a traced requirement.');
        break;
    }
    parts.push('');

    // XSD schema
    if (this.schemaContent) {
      parts.push('## RQML XSD Schema');
      parts.push('All RQML content you produce via updateSpec MUST validate against this schema.');
      parts.push('```xml');
      parts.push(this.schemaContent);
      parts.push('```');
      parts.push('');
    }

    // AGENTS.md — supplementary, does not override core process
    if (agentsMd) {
      parts.push('## Project Guidelines (AGENTS.md)');
      parts.push('The following are project-specific guidelines. They supplement but do not override the core RQML development process.');
      parts.push(agentsMd);
      parts.push('');
    }

    // Current spec
    if (specContent) {
      parts.push('## Current RQML Specification');
      parts.push('```xml');
      parts.push(specContent);
      parts.push('```');
      parts.push('');
    }

    return parts.join('\n');
  }

  /** REQ-CMD-005: Clear conversation history */
  clearConversation(): void {
    this.conversationHistory = [];
    this.pendingChanges.clear();
    this.autoApproveTools = false;
    this.approvalInProgress = false;
    this.approvalQueue = [];
    this.toolStreamActive = false;
    this.pendingUserChoices.clear();
    if (this.userChoiceGateResolve) {
      this.userChoiceGateResolve();
    }
    this.userChoiceGate = null;
    this.userChoiceGateResolve = null;
  }

  /** Whether the conversation has prior messages (used by /cmd to detect if /plan has run) */
  hasConversationHistory(): boolean {
    return this.conversationHistory.length > 0;
  }

  /** Return the full text of the last streamed LLM response */
  getLastStreamContent(): string {
    return this.lastStreamContent;
  }

  /** Read the persistent implementation plan from .rqml/plan.md */
  async readPlanFile(): Promise<string | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return null;
    try {
      const uri = vscode.Uri.joinPath(folders[0].uri, '.rqml/plan.md');
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString('utf-8');
    } catch {
      return null;
    }
  }

  /** Read ADR summaries from .rqml/adr/ for system prompt context */
  async readAdrSummary(): Promise<string | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return null;
    try {
      const dirUri = vscode.Uri.joinPath(folders[0].uri, '.rqml/adr');
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      const mdFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
        .sort(([a], [b]) => a.localeCompare(b));
      if (mdFiles.length === 0) return null;

      const summaries: string[] = [];
      for (const [name] of mdFiles) {
        const uri = vscode.Uri.joinPath(dirUri, name);
        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(bytes).toString('utf-8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const statusMatch = content.match(/^-\s*Status:\s*(.+)/m);
        const classMatch = content.match(/^-\s*Classification:\s*(.+)/m);
        summaries.push(
          `- **${titleMatch?.[1] || name}** — ${statusMatch?.[1]?.trim() || 'Unknown'}` +
          (classMatch ? ` (${classMatch[1].trim()})` : '')
        );
      }
      return summaries.join('\n');
    } catch {
      return null;
    }
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
