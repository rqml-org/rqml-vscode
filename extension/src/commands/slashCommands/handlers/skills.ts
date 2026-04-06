// Agent Skills management command (https://agentskills.io/)

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';
import { getSkillService } from '../../../services/skillService';

const SOURCE_LABELS: Record<string, string> = {
  'user': '~/.agents/skills/',
  'project-agents': '.agents/skills/',
  'project-rqml': '.rqml/skills/',
};

export function createSkillsCommands(): SlashCommand[] {
  const skillsCommand: SlashCommand = {
    name: 'skills',
    description: 'List and inspect available Agent Skills',
    usage: '/skills [list|show|refresh] [<skill-name>]',
    category: 'help',
    subcommands: [
      { name: 'list', description: 'List all discovered skills (default)' },
      { name: 'show', description: 'Show full content of a skill' },
      { name: 'refresh', description: 'Re-scan skill directories' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const sub = parsed.subcommand || '';
      const arg = parsed.args.join(' ');

      switch (sub) {
        case 'show':
          await handleShow(arg, ctx);
          break;
        case 'refresh':
          await handleRefresh(ctx);
          break;
        case 'list':
        default:
          handleList(ctx);
          break;
      }
    },
  };

  return [skillsCommand];
}

function handleList(ctx: CommandContext): void {
  const skills = getSkillService().getCatalog();

  if (skills.length === 0) {
    ctx.reply(
      '**No skills found.**\n\n' +
      'Skills are discovered from:\n' +
      '- `~/.agents/skills/` — user-level\n' +
      '- `<workspace>/.agents/skills/` — project-level\n' +
      '- `<workspace>/.rqml/skills/` — RQML-specific\n\n' +
      'Each skill is a directory containing a `SKILL.md` file with YAML frontmatter.\n' +
      'See [agentskills.io](https://agentskills.io/) for the standard.'
    );
    return;
  }

  const lines: string[] = [`**Agent Skills** (${skills.length} found)`, ''];

  for (const s of skills) {
    const source = SOURCE_LABELS[s.source] || s.source;
    lines.push(`- **${s.name}** — ${s.description}`);
    lines.push(`  Source: \`${source}\``);
  }

  ctx.reply(lines.join('\n'));
}

async function handleShow(name: string, ctx: CommandContext): Promise<void> {
  if (!name) {
    ctx.reply('Usage: `/skills show <skill-name>`');
    return;
  }

  const content = await getSkillService().getSkillContent(name);
  if (!content) {
    ctx.reply(`Skill "${name}" not found. Use \`/skills list\` to see available skills.`);
    return;
  }

  ctx.reply(`**Skill: ${name}**\n\n\`\`\`markdown\n${content}\n\`\`\``);
}

async function handleRefresh(ctx: CommandContext): Promise<void> {
  await getSkillService().refresh();
  const count = getSkillService().getCatalog().length;
  ctx.system(`Skills refreshed. ${count} skill${count === 1 ? '' : 's'} found.`);
}
