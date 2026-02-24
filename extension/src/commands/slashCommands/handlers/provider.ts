// REQ-CMD-006: Provider and model management commands

import * as vscode from 'vscode';
import type { SlashCommand, ParsedCommand, CommandContext } from '../types';
import { getModelCatalogService } from '../../../services/modelCatalogService';

export function createProviderCommands(): SlashCommand[] {
  const providersCommand: SlashCommand = {
    name: 'providers',
    aliases: ['endpoints'],
    description: 'List configured LLM endpoints',
    category: 'provider',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const config = ctx.services.config;
      const endpoints = config.getEndpoints();
      const activeId = config.getActiveEndpointId();

      if (endpoints.length === 0) {
        ctx.reply('No endpoints configured. Use "RQML: Add LLM Endpoint" from the command palette.');
        return;
      }

      const lines: string[] = ['**Configured Endpoints**', ''];
      for (const ep of endpoints) {
        const active = ep.id === activeId ? ' **(active)**' : '';
        const model = ep.model ? ` — model: ${ep.model}` : '';
        lines.push(`- \`${ep.name}\` (${ep.provider})${model}${active}`);
      }
      ctx.reply(lines.join('\n'));
    },
  };

  const providerCommand: SlashCommand = {
    name: 'provider',
    description: 'Switch the active LLM endpoint',
    usage: '/provider use <endpoint-name>',
    category: 'provider',
    subcommands: [
      { name: 'use', description: 'Set the active endpoint by name' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.subcommand === 'use') {
        const name = parsed.args.join(' ');
        if (!name) {
          ctx.reply('Usage: `/provider use <endpoint-name>`');
          return;
        }

        const config = ctx.services.config;
        const endpoints = config.getEndpoints();
        const match = endpoints.find(e => e.name.toLowerCase() === name.toLowerCase());

        if (!match) {
          const available = endpoints.map(e => `\`${e.name}\``).join(', ');
          ctx.reply(`Endpoint "${name}" not found. Available: ${available || 'none'}`);
          return;
        }

        await config.setActiveEndpointId(match.id);
        ctx.reply(`Switched to endpoint **${match.name}** (${match.provider}).`);
        return;
      }

      // No subcommand — show current
      const config = ctx.services.config;
      const active = config.getActiveEndpoint();
      if (active) {
        ctx.reply(`Active endpoint: **${active.name}** (${active.provider}${active.model ? `, model: ${active.model}` : ''})`);
      } else {
        ctx.reply('No active endpoint. Use `/providers` to list or `/provider use <name>` to select.');
      }
    },
  };

  const keysCommand: SlashCommand = {
    name: 'keys',
    aliases: ['key'],
    description: 'Manage API keys for endpoints',
    usage: '/keys [set|test]',
    category: 'provider',
    subcommands: [
      { name: 'set', description: 'Set API key for the active endpoint (opens input)' },
      { name: 'test', description: 'Test connectivity for the active endpoint' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.subcommand === 'set') {
        // Delegate to the VS Code command (opens secure input box)
        await vscode.commands.executeCommand('rqml-vscode.configureApiKey');
        ctx.system('API key configuration dialog opened.');
        return;
      }

      if (parsed.subcommand === 'test') {
        const config = ctx.services.config;
        const active = config.getActiveEndpoint();
        if (!active) {
          ctx.reply('No active endpoint configured.');
          return;
        }

        const hasKey = await config.getEndpointApiKey(active.id);
        if (!hasKey) {
          ctx.reply(`No API key stored for **${active.name}**. Use \`/keys set\` to configure.`);
          return;
        }

        ctx.system('Testing endpoint connectivity...');
        try {
          const llm = ctx.services.llm;
          const ready = await llm.isReady();
          if (ready) {
            ctx.reply(`Endpoint **${active.name}** is reachable.`);
          } else {
            ctx.reply(`Endpoint **${active.name}** is not ready. Check your configuration.`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          ctx.reply(`Endpoint test failed: ${msg}`);
        }
        return;
      }

      // No subcommand — show key status for all endpoints
      const config = ctx.services.config;
      const endpoints = config.getEndpoints();
      if (endpoints.length === 0) {
        ctx.reply('No endpoints configured.');
        return;
      }

      const lines: string[] = ['**API Key Status**', ''];
      for (const ep of endpoints) {
        const masked = await config.getEndpointApiKeyMasked(ep.id);
        lines.push(`- \`${ep.name}\`: ${masked}`);
      }
      ctx.reply(lines.join('\n'));
    },
  };

  const llmCommand: SlashCommand = {
    name: 'llm',
    description: 'Quick LLM status — shows active endpoint and readiness',
    category: 'provider',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const config = ctx.services.config;
      const active = config.getActiveEndpoint();
      const ready = await ctx.services.llm.isReady();

      const lines: string[] = [];
      if (active) {
        const catalogService = getModelCatalogService();
        const modelId = catalogService.getSelectedModelId(active);
        lines.push(`**${active.name}** (${active.provider} / ${modelId})`);
        lines.push(`Status: ${ready ? 'ready' : 'not ready'}`);
      } else {
        lines.push('No LLM endpoint configured.');
        lines.push('Use "RQML: Add LLM Endpoint" from the command palette.');
      }
      ctx.reply(lines.join('\n'));
    },
  };

  return [providersCommand, providerCommand, keysCommand, llmCommand];
}
