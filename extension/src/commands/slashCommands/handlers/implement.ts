// /implement: Run one stage of the implementation plan using tool use

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

const HAS_PLAN_PREAMBLE =
  'A plan exists in the conversation. Based on it, implement the next stage.';

const NO_PLAN_HINT =
  'No implementation plan found in this conversation. ' +
  'Consider running /plan first to generate a staged plan. ' +
  'Proceeding to implement based on the spec requirements directly.';

export function createImplementCommands(): SlashCommand[] {
  const implementCommand: SlashCommand = {
    name: 'implement',
    description: 'Implement the next stage of the plan (or a specific requirement)',
    usage: '/implement [<REQ-ID | PKG-ID>]',
    category: 'coding',
    requiresSpec: true,
    requiresLlm: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const target = parsed.args.length > 0 ? parsed.args.join(' ') : undefined;

      // Inform the user about what's happening
      if (target) {
        ctx.system(`Starting implementation for: ${target}`);
      } else {
        const hasPlan = ctx.services.agent.hasConversationHistory();
        ctx.system(hasPlan ? HAS_PLAN_PREAMBLE : NO_PLAN_HINT);
      }

      // Run the agentic tool loop
      await ctx.services.agent.runToolStream(target);
    },
  };

  return [implementCommand];
}
