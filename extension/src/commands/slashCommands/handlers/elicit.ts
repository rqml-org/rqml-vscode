// /elicit: Guided requirements elicitation through structured questioning

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

const ELICIT_INSTRUCTIONS =
  'You are conducting a requirements elicitation session. Your job is to ask structured, ' +
  'clarifying questions and then propose well-formed RQML requirements.\n\n' +
  'Guidelines:\n' +
  '- Ask about: the goal (what problem does this solve?), scope (what is in/out?), ' +
  'actors (who uses it?), acceptance criteria (how do we know it works?), and constraints.\n' +
  '- Do NOT assume—capture assumptions as <notes> elements.\n' +
  '- Mark all new requirements as status="draft".\n' +
  '- Use correct RQML ID patterns: REQ-{PKG}-{NNN}, GOAL-{area}-{NNN}, PKG-{area}.\n' +
  '- Include BDD-style acceptance criteria with <when>/<then> blocks.\n' +
  '- Avoid duplicating requirements that already exist in the spec.\n' +
  '- When you have enough information, propose the new requirements using a :::CHANGE_PROPOSAL::: block ' +
  'containing the complete updated RQML file.\n' +
  '- If no spec exists yet, propose creating one with the elicited requirements.\n';

const NO_SPEC_PREAMBLE =
  '[SYSTEM] No RQML specification file is loaded. Start from scratch: ' +
  'help the user define the system they are building, then propose an initial spec. ';

const HAS_SPEC_PREAMBLE =
  '[SYSTEM] An RQML specification is loaded. Review it for gaps and missing coverage. ';

const HAS_HISTORY_NOTE =
  'Continue the elicitation from the prior conversation context. ';

export function createElicitCommands(): SlashCommand[] {
  const elicitCommand: SlashCommand = {
    name: 'elicit',
    description: 'Elicit and draft new requirements through guided questioning',
    usage: '/elicit [<topic>]',
    category: 'planning',
    requiresLlm: true,
    requiresSpec: false,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const topic = parsed.args.length > 0 ? parsed.args.join(' ') : '';
      const hasSpec = !!ctx.services.spec.state.document;
      const hasHistory = ctx.services.agent.hasConversationHistory();

      // Build context-dependent prompt
      let prompt: string;

      if (!hasSpec && !topic) {
        // No spec, no topic — open-ended elicitation
        prompt =
          NO_SPEC_PREAMBLE +
          ELICIT_INSTRUCTIONS +
          'Ask the user what system they are building and guide them through ' +
          'defining the initial goals, actors, and core requirements.';
      } else if (!hasSpec && topic) {
        // No spec, with topic — focused initial elicitation
        prompt =
          NO_SPEC_PREAMBLE +
          ELICIT_INSTRUCTIONS +
          `The user wants to elicit requirements for: ${topic}. ` +
          'Ask clarifying questions about this topic, then propose an initial spec ' +
          'with the elicited requirements.';
      } else if (hasSpec && !topic) {
        // Spec exists, no topic — gap analysis
        prompt =
          HAS_SPEC_PREAMBLE +
          ELICIT_INSTRUCTIONS +
          'Review the current spec for gaps, missing requirements, incomplete acceptance criteria, ' +
          'and uncovered feature areas. Ask the user about areas that need attention.';
      } else {
        // Spec exists, with topic — focused addition
        prompt =
          HAS_SPEC_PREAMBLE +
          ELICIT_INSTRUCTIONS +
          `The user wants to elicit requirements for: ${topic}. ` +
          'Review the current spec for any existing coverage of this topic, ' +
          'then ask clarifying questions and propose new requirements to add.';
      }

      if (hasHistory) {
        prompt += '\n\n' + HAS_HISTORY_NOTE;
      }

      await ctx.streamPrompt(prompt);
    },
  };

  return [elicitCommand];
}
