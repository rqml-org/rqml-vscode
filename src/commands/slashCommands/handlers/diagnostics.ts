// REQ-CMD-011: Diagnostics and troubleshooting commands

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

export function createDiagnosticsCommands(): SlashCommand[] {
  const doctorCommand: SlashCommand = {
    name: 'doctor',
    description: 'Run a health check on the extension environment',
    category: 'diagnostics',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const config = ctx.services.config;
      const spec = ctx.services.spec;
      const llm = ctx.services.llm;

      const lines: string[] = ['**RQML Doctor**', ''];

      // Spec status
      const specState = spec.state;
      if (specState.document) {
        lines.push(`Spec: loaded (\`${specState.document.docId}\`)`);
      } else if (specState.status === 'none') {
        lines.push('Spec: no .rqml file found');
      } else if (specState.status === 'multiple') {
        lines.push(`Spec: multiple .rqml files found (${specState.files.length})`);
      } else if (specState.status === 'invalid') {
        lines.push(`Spec: invalid — ${specState.error || 'parse error'}`);
      }

      // Endpoint status
      const endpoint = config.getActiveEndpoint();
      if (endpoint) {
        lines.push(`Endpoint: ${endpoint.name} (${endpoint.provider})`);
        const ready = await llm.isReady();
        lines.push(`LLM ready: ${ready ? 'yes' : 'no'}`);
      } else {
        lines.push('Endpoint: not configured');
      }

      // Strictness
      lines.push(`Strictness: ${config.getStrictnessSetting() || 'standard (default)'}`);

      // Commands registered
      const cmdCount = ctx.services.agent.commandRegistry.getAllNames().length;
      lines.push(`Commands: ${cmdCount} registered`);

      ctx.reply(lines.join('\n'));
    },
  };

  const logsCommand: SlashCommand = {
    name: 'logs',
    description: 'Show how to access extension logs',
    category: 'diagnostics',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      ctx.reply(
        '**Extension Logs**\n\n' +
        'To view RQML extension logs:\n' +
        '1. Open the Output panel (View → Output)\n' +
        '2. Select "RQML" from the dropdown\n\n' +
        'For developer console logs:\n' +
        '- Help → Toggle Developer Tools → Console tab'
      );
    },
  };

  const feedbackCommand: SlashCommand = {
    name: 'feedback',
    description: 'Show how to report issues or give feedback',
    category: 'diagnostics',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      ctx.reply(
        '**Feedback & Issues**\n\n' +
        'Report bugs or request features:\n' +
        '- Use "RQML: Report Issue" from the command palette\n' +
        '- Or describe the issue here and I can help you draft a report'
      );
    },
  };

  return [doctorCommand, logsCommand, feedbackCommand];
}
