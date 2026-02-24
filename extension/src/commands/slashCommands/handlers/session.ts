// REQ-CMD-005: Session management commands

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

export function createSessionCommands(): SlashCommand[] {
  const clearCommand: SlashCommand = {
    name: 'clear',
    description: 'Clear the terminal and conversation history',
    category: 'session',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      ctx.services.agent.clearConversation();
      ctx.services.agent.fireMessage({
        type: 'clearTerminal',
        payload: {}
      });
      ctx.system('Conversation cleared.');
    },
  };

  const newCommand: SlashCommand = {
    name: 'new',
    description: 'Start a fresh conversation (keeps terminal output)',
    category: 'session',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      ctx.services.agent.clearConversation();
      ctx.system('New conversation started.');
    },
  };

  const compactCommand: SlashCommand = {
    name: 'compact',
    description: 'Summarise conversation context to reduce token usage',
    usage: '/compact',
    category: 'session',
    requiresLlm: true,

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      await ctx.streamPrompt(
        '[SYSTEM] Please provide a very concise summary of this conversation so far, ' +
        'capturing the key decisions, changes made, and any open items. ' +
        'This summary will replace the conversation history to reduce token usage.'
      );
    },
  };

  const exportCommand: SlashCommand = {
    name: 'export',
    description: 'Export the current conversation as markdown',
    category: 'session',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      // For now, inform the user this is a planned feature
      ctx.reply('Conversation export is not yet implemented.');
    },
  };

  return [clearCommand, newCommand, compactCommand, exportCommand];
}
