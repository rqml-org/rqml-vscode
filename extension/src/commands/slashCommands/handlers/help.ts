// REQ-CMD-004: Help and discovery commands

import type { SlashCommand, ParsedCommand, CommandContext, CommandCategory } from '../types';
import type { CommandRegistry } from '../registry';

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  help: 'Help & Discovery',
  session: 'Session Management',
  provider: 'Provider & Model',
  quality: 'Quality & Health',
  sync: 'Sync & Traceability',
  planning: 'Planning',
  coding: 'Coding Agent',
  diagnostics: 'Diagnostics',
};

const CATEGORY_ORDER: CommandCategory[] = [
  'help', 'session', 'provider', 'quality',
  'sync', 'planning', 'coding', 'diagnostics',
];

export function createHelpCommands(registry: CommandRegistry): SlashCommand[] {
  const helpCommand: SlashCommand = {
    name: 'help',
    aliases: ['?', 'commands'],
    description: 'Show available commands or help for a specific command',
    usage: '/help [command]',
    category: 'help',

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      // /help <command> — show detailed help for a specific command
      if (parsed.args.length > 0) {
        const target = parsed.args[0].replace(/^\//, '');
        const cmd = registry.resolve(target);
        if (!cmd) {
          ctx.reply(`Unknown command: \`/${target}\``);
          return;
        }

        const lines: string[] = [];
        lines.push(`**/${cmd.name}** — ${cmd.description}`);
        if (cmd.aliases?.length) {
          lines.push(`Aliases: ${cmd.aliases.map(a => `\`/${a}\``).join(', ')}`);
        }
        if (cmd.usage) {
          lines.push(`Usage: \`${cmd.usage}\``);
        }
        if (cmd.subcommands?.length) {
          lines.push('');
          lines.push('Subcommands:');
          for (const sub of cmd.subcommands) {
            lines.push(`  \`${sub.name}\` — ${sub.description}`);
          }
        }
        if (cmd.requiresLlm) {
          lines.push(`_Requires LLM endpoint_`);
        }
        if (cmd.requiresSpec) {
          lines.push(`_Requires loaded spec_`);
        }
        ctx.reply(lines.join('\n'));
        return;
      }

      // /help — show all commands grouped by category
      const allCommands = registry.getAllCommands();
      const byCategory = new Map<CommandCategory, typeof allCommands>();
      for (const cmd of allCommands) {
        const list = byCategory.get(cmd.category) ?? [];
        list.push(cmd);
        byCategory.set(cmd.category, list);
      }

      const lines: string[] = ['**RQML Agent Commands**', ''];
      for (const cat of CATEGORY_ORDER) {
        const cmds = byCategory.get(cat);
        if (!cmds?.length) continue;
        lines.push(`**${CATEGORY_LABELS[cat]}**`);
        for (const cmd of cmds) {
          const aliasStr = cmd.aliases?.length ? ` (${cmd.aliases.map(a => `/${a}`).join(', ')})` : '';
          lines.push(`  \`/${cmd.name}\`${aliasStr} — ${cmd.description}`);
        }
        lines.push('');
      }
      lines.push('Type `/help <command>` for detailed usage.');
      ctx.reply(lines.join('\n'));
    },
  };

  const aboutCommand: SlashCommand = {
    name: 'about',
    description: 'Show agent version and environment info',
    category: 'help',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const configService = ctx.services.config;
      const active = configService.getActiveModel();
      const specState = ctx.services.spec.state;

      const lines: string[] = ['**RQML Agent**', ''];
      lines.push(`Spec: ${specState.document ? 'loaded' : 'none'}`);
      lines.push(`Active model: ${active ? `\`${active.modelId}\` (${active.providerId})` : 'not selected'}`);
      lines.push(`Strictness: ${configService.getStrictnessSetting() || 'standard'}`);
      ctx.reply(lines.join('\n'));
    },
  };

  return [helpCommand, aboutCommand];
}
