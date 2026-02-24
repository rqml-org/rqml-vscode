// REQ-CMD-009: Implementation planning command

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

export function createPlanCommands(): SlashCommand[] {
  const AGENT_CONTEXT =
    'The implementation will be carried out by AI coding agents (e.g. Claude Code, Codex CLI, Copilot). ' +
    'Do NOT estimate human time/weeks. Instead, frame each stage as a self-contained agent task: ' +
    'what the agent should do, which files/modules it should touch, what inputs it needs (spec sections, existing code), ' +
    'and how to verify the output (tests, build, lint). ';

  const planCommand: SlashCommand = {
    name: 'plan',
    description: 'Generate a staged implementation plan from the spec (--full for detailed report)',
    usage: '/plan [--full] [<target>]',
    category: 'planning',
    requiresSpec: true,
    requiresLlm: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const target = parsed.args.length > 0 ? parsed.args.join(' ') : '';
      const isFull = parsed.flags.has('full');

      let prompt: string;
      if (isFull) {
        // Detailed plan
        if (target) {
          prompt =
            `[SYSTEM] Generate a detailed, staged implementation plan for: ${target}. ` +
            AGENT_CONTEXT +
            'For each stage include: goal, input requirements (by ID), files to create or modify, ' +
            'acceptance criteria to satisfy, verification commands, and trace expectations. ' +
            'Start with a readiness verdict (READY / NOT READY) and list any blockers.';
        } else {
          prompt =
            '[SYSTEM] Generate a detailed, staged implementation plan for all unimplemented requirements in the spec. ' +
            AGENT_CONTEXT +
            'Group by package or feature area. For each stage include: goal, input requirements (by ID), ' +
            'files to create or modify, acceptance criteria, verification commands, and trace expectations. ' +
            'Start with a readiness verdict (READY / NOT READY) and list any blockers.';
        }
      } else {
        // Concise overview
        if (target) {
          prompt =
            `[SYSTEM] Give a concise implementation overview for: ${target}. ` +
            AGENT_CONTEXT +
            'List the stages in order, one line per stage: stage name, scope (requirement IDs), ' +
            'and key output. End with a readiness verdict (READY / NOT READY) and any blockers.';
        } else {
          prompt =
            '[SYSTEM] Give a concise implementation overview for all unimplemented requirements in the spec. ' +
            AGENT_CONTEXT +
            'List the stages in order, one line per stage: stage name, scope (requirement IDs), ' +
            'and key output. End with a readiness verdict (READY / NOT READY) and any blockers.';
        }
      }

      await ctx.streamPrompt(prompt);
    },
  };

  return [planCommand];
}
