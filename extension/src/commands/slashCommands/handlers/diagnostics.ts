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
        if (specState.files.length > 1) {
          const active = specState.activeSpecUri?.fsPath.split('/').pop() || 'unknown';
          lines.push(`Spec files: ${specState.files.length} found, active: \`${active}\``);
        }
      } else if (specState.status === 'none') {
        lines.push('Spec: no .rqml file found');
      } else if (specState.status === 'invalid') {
        lines.push(`Spec: invalid — ${specState.error || 'parse error'}`);
      }

      // Active model / provider status
      const active = config.getActiveModel();
      if (active) {
        lines.push(`Active model: \`${active.modelId}\` (${active.providerId})`);
        const ready = await llm.isReady();
        lines.push(`LLM ready: ${ready ? 'yes' : 'no'}`);
      } else {
        lines.push('Active model: not selected');
      }

      const configured = await config.getConfiguredProviders();
      lines.push(`Configured providers: ${configured.length ? configured.join(', ') : 'none'}`);

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
