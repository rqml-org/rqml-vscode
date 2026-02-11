// REQ-CMD-008: Sync and traceability commands

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

export function createSyncCommands(): SlashCommand[] {
  const syncCommand: SlashCommand = {
    name: 'sync',
    description: 'Check spec-code synchronisation status',
    usage: '/sync [status|scan]',
    category: 'sync',
    requiresSpec: true,
    subcommands: [
      { name: 'status', description: 'Quick sync status summary' },
      { name: 'scan', description: 'Deep LLM-based sync scan' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.subcommand === 'scan') {
        if (!(await ctx.services.llm.isReady())) {
          ctx.reply('`/sync scan` requires a configured LLM endpoint.');
          return;
        }
        await ctx.streamPrompt(
          '[SYSTEM] Please perform a comprehensive spec-code synchronisation scan. ' +
          'Identify: requirements without implementation traces, code without corresponding specs, ' +
          'outdated traces, and any ghost features. Provide a structured report.'
        );
        return;
      }

      // Default: /sync or /sync status — local trace summary
      const doc = ctx.services.spec.state.document!;
      const edges = doc.traceEdges;

      // Collect all traced IDs
      const tracedFroms = new Set(edges.map(e => e.from));
      const tracedTos = new Set(edges.map(e => e.to));

      // Collect all requirement IDs
      const reqSection = doc.sections.get('requirements');
      const allReqIds: string[] = [];
      if (reqSection) {
        const collect = (items: Array<{ id: string; children?: unknown[] }>) => {
          for (const item of items) {
            allReqIds.push(item.id);
            if (item.children && Array.isArray(item.children)) {
              collect(item.children as Array<{ id: string; children?: unknown[] }>);
            }
          }
        };
        collect(reqSection.items);
      }

      const untraced = allReqIds.filter(id => !tracedFroms.has(id) && !tracedTos.has(id));
      const traceTypes = new Map<string, number>();
      for (const e of edges) {
        traceTypes.set(e.type, (traceTypes.get(e.type) || 0) + 1);
      }

      const lines: string[] = ['**Sync Status**', ''];
      lines.push(`Trace edges: ${edges.length}`);
      if (traceTypes.size > 0) {
        lines.push('By type:');
        for (const [type, count] of traceTypes) {
          lines.push(`  ${type}: ${count}`);
        }
      }
      lines.push('');
      lines.push(`Requirements: ${allReqIds.length} total`);
      if (untraced.length > 0) {
        lines.push(`Untraced: ${untraced.length} — ${untraced.slice(0, 10).map(id => `\`${id}\``).join(', ')}${untraced.length > 10 ? ` ... and ${untraced.length - 10} more` : ''}`);
      } else {
        lines.push('All requirements have trace edges.');
      }
      ctx.reply(lines.join('\n'));
    },
  };

  const traceCommand: SlashCommand = {
    name: 'trace',
    description: 'Show trace edges for a specific requirement ID',
    usage: '/trace <REQ-ID>',
    category: 'sync',
    requiresSpec: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.args.length === 0) {
        ctx.reply('Usage: `/trace <REQ-ID>` — e.g. `/trace REQ-UI-001`');
        return;
      }

      const targetId = parsed.args[0].toUpperCase();
      const doc = ctx.services.spec.state.document!;
      const edges = doc.traceEdges;

      const outgoing = edges.filter(e => e.from === targetId);
      const incoming = edges.filter(e => e.to === targetId);

      if (outgoing.length === 0 && incoming.length === 0) {
        ctx.reply(`No trace edges found for \`${targetId}\`.`);
        return;
      }

      const lines: string[] = [`**Trace: ${targetId}**`, ''];
      if (outgoing.length > 0) {
        lines.push('**Outgoing:**');
        for (const e of outgoing) {
          lines.push(`  \`${e.id}\`: ${targetId} → \`${e.to}\` (${e.type})${e.notes ? ` — ${e.notes}` : ''}`);
        }
      }
      if (incoming.length > 0) {
        lines.push('**Incoming:**');
        for (const e of incoming) {
          lines.push(`  \`${e.id}\`: \`${e.from}\` → ${targetId} (${e.type})${e.notes ? ` — ${e.notes}` : ''}`);
        }
      }
      ctx.reply(lines.join('\n'));
    },
  };

  const diffCommand: SlashCommand = {
    name: 'diff',
    description: 'Compare spec vs implementation (--full for detailed report)',
    usage: '/diff [--full]',
    category: 'sync',
    requiresSpec: true,
    requiresLlm: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.flags.has('full')) {
        await ctx.streamPrompt(
          '[SYSTEM] Compare the current RQML specification with the implementation. ' +
          'Identify: gaps where the spec describes features not yet implemented, ' +
          'ghost features in code not covered by the spec, and any mismatches in behaviour. ' +
          'Format as a structured diff report.'
        );
      } else {
        await ctx.streamPrompt(
          '[SYSTEM] Give a brief summary of spec vs implementation status. ' +
          'For each package or feature area, state whether it is: fully implemented, ' +
          'partially implemented, or not started. Keep it concise — one line per area. ' +
          'End with a short overall coverage assessment.'
        );
      }
    },
  };

  return [syncCommand, traceCommand, diffCommand];
}
