// REQ-CMD-010: Coding agent command generation

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

const CMD_STYLE =
  'Keep instructions high-level — reference requirement IDs and package IDs from the spec ' +
  'instead of reproducing their text (e.g. "Implement PKG-AUTH per the spec"). ' +
  'Do NOT include code snippets, class definitions, or low-level implementation details. ' +
  'The agent has access to the full RQML spec and codebase. ' +
  'Format the prompt in a single fenced code block so it can be copied directly into a coding agent.';

const PLAN_PREAMBLE =
  '[SYSTEM] No implementation plan exists in this conversation yet. ' +
  'First, produce a concise staged plan (one line per stage: name, requirement/package scope, key output). ' +
  'Then, based on that plan and the current spec↔code state, ';

const HAS_PLAN_PREAMBLE =
  '[SYSTEM] Based on the implementation plan from this conversation and the current spec↔code state, ';

export function createCmdCommands(): SlashCommand[] {
  const cmdCommand: SlashCommand = {
    name: 'cmd',
    description: 'Generate a concise coding-agent prompt for the next implementation step',
    usage: '/cmd [next|all] [<REQ-ID | PKG-ID>]',
    category: 'coding',
    requiresSpec: true,
    requiresLlm: true,
    subcommands: [
      { name: 'next', description: 'Prompt for the next unimplemented stage' },
      { name: 'all', description: 'Prompts for all remaining stages' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const target = parsed.args.length > 0 ? parsed.args.join(' ') : '';

      // Check whether a plan already exists in conversation context.
      // The LLM sees the full conversation, so we hint it to look for a prior plan.
      const preamble = ctx.services.agent.hasConversationHistory()
        ? HAS_PLAN_PREAMBLE
        : PLAN_PREAMBLE;

      let suffix: string;
      if (parsed.subcommand === 'all') {
        suffix =
          'generate a coding-agent prompt for each remaining stage. ' +
          'Each prompt should be a self-contained task block with: stage goal, ' +
          'requirement/package scope (by ID), files/modules to touch, and verification steps. ' +
          CMD_STYLE;
      } else if (target) {
        suffix =
          `generate a coding-agent prompt to implement: ${target}. ` +
          'Include: scope (requirement/package IDs), files/modules to touch, and verification steps. ' +
          CMD_STYLE;
      } else {
        suffix =
          'generate a coding-agent prompt for the logical next step ' +
          '(the highest-priority unimplemented stage or requirement). ' +
          'Include: scope (requirement/package IDs), files/modules to touch, and verification steps. ' +
          CMD_STYLE;
      }

      await ctx.streamPrompt(preamble + suffix);
      ctx.offerCopy();
    },
  };

  return [cmdCommand];
}
