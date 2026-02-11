// REQ-CMD-001: Slash command registry — parse, resolve, dispatch

import type { SlashCommand, ParsedCommand, CommandContext } from './types';

/**
 * CommandRegistry — manages slash command registration, parsing, and dispatch.
 */
export class CommandRegistry {
  private commands = new Map<string, SlashCommand>();
  private aliases = new Map<string, string>();

  /** Register a slash command (and its aliases) */
  register(cmd: SlashCommand): void {
    this.commands.set(cmd.name, cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliases.set(alias, cmd.name);
      }
    }
  }

  /** Resolve a command name (or alias) to its SlashCommand definition */
  resolve(name: string): SlashCommand | undefined {
    return this.commands.get(name) ?? this.commands.get(this.aliases.get(name) ?? '');
  }

  /** Parse a raw slash command string into a ParsedCommand */
  parse(raw: string): ParsedCommand | undefined {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('/')) return undefined;

    const tokens = trimmed.slice(1).split(/\s+/);
    if (tokens.length === 0 || tokens[0] === '') return undefined;

    const name = tokens[0].toLowerCase();
    const cmd = this.resolve(name);

    let subcommand: string | undefined;
    let argStart = 1;

    // Check if the second token is a known subcommand
    if (cmd?.subcommands && tokens.length > 1) {
      const sub = tokens[1].toLowerCase();
      if (cmd.subcommands.some(s => s.name === sub)) {
        subcommand = sub;
        argStart = 2;
      }
    }

    const args: string[] = [];
    const flags = new Map<string, string | true>();

    for (let i = argStart; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith('--')) {
        const eqIdx = token.indexOf('=');
        if (eqIdx > 0) {
          flags.set(token.slice(2, eqIdx), token.slice(eqIdx + 1));
        } else {
          flags.set(token.slice(2), true);
        }
      } else {
        args.push(token);
      }
    }

    return { name, subcommand, args, flags, raw: trimmed };
  }

  /** Execute a parsed command with pre-flight checks */
  async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
    const cmd = this.resolve(parsed.name);
    if (!cmd) {
      ctx.reply(`Unknown command: \`/${parsed.name}\`. Type \`/help\` for available commands.`);
      return;
    }

    // Pre-flight: LLM required?
    if (cmd.requiresLlm) {
      const llmService = ctx.services.llm;
      if (!(await llmService.isReady())) {
        ctx.reply('This command requires a configured LLM endpoint. Use "RQML: Add LLM Endpoint" from the command palette.');
        return;
      }
    }

    // Pre-flight: Spec required?
    if (cmd.requiresSpec) {
      const specState = ctx.services.spec.state;
      if (!specState.document) {
        ctx.reply('This command requires a loaded RQML specification. Open a `.rqml` file first.');
        return;
      }
    }

    await cmd.execute(parsed, ctx);
  }

  /** Get all registered command names (not aliases) — for autocomplete */
  getAllNames(): string[] {
    return Array.from(this.commands.keys()).sort();
  }

  /** Get all registered commands grouped by category — for /help */
  getAllCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }
}
