// REQ-CMD-001: Slash command type definitions

import type { SpecService } from '../../services/specService';
import type { DiagnosticsService } from '../../services/diagnosticsService';
import type { ConfigurationService } from '../../services/configurationService';
import type { LlmService } from '../../services/llmService';
import type { AgentService } from '../../services/agentService';

/** Context provided to every slash command handler */
export interface CommandContext {
  /** Send an immediate (non-streaming) markdown response */
  reply(content: string): void;
  /** Send a dim/italic system message */
  system(content: string): void;
  /** Inject a prompt into the LLM conversation and stream the response */
  streamPrompt(prompt: string): Promise<void>;
  /** Show a clickable [Copy to clipboard] link for the last streamed response */
  offerCopy(): void;
  /** Access to all services */
  services: {
    spec: SpecService;
    diagnostics: DiagnosticsService;
    config: ConfigurationService;
    llm: LlmService;
    agent: AgentService;
  };
}

/** Result of parsing a slash command string */
export interface ParsedCommand {
  /** Base command name, e.g. "status" from "/status --full" */
  name: string;
  /** Subcommand if any, e.g. "scan" from "/sync scan" */
  subcommand?: string;
  /** Positional arguments after command/subcommand */
  args: string[];
  /** Flags parsed from "--flag" or "--flag=value" */
  flags: Map<string, string | true>;
  /** Original raw text */
  raw: string;
}

export type CommandCategory =
  | 'help'
  | 'session'
  | 'provider'
  | 'quality'
  | 'sync'
  | 'planning'
  | 'coding'
  | 'diagnostics';

export interface SubcommandDef {
  name: string;
  description: string;
}

/** Metadata and handler for a registered slash command */
export interface SlashCommand {
  /** Primary name (e.g. "help") */
  name: string;
  /** Aliases that also resolve to this command */
  aliases?: string[];
  /** Short description for /help listing */
  description: string;
  /** Full usage string for /help <command> */
  usage?: string;
  /** Category for grouping in /help */
  category: CommandCategory;
  /** Whether this command requires an active LLM endpoint */
  requiresLlm?: boolean;
  /** Whether this command requires a loaded RQML spec */
  requiresSpec?: boolean;
  /** Subcommands if this is a command group */
  subcommands?: SubcommandDef[];
  /** The handler */
  execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void>;
}
