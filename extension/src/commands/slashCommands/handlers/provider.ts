// REQ-CMD-006: Provider and model management commands
// REQ-CFG-013: Singleton-per-provider architecture

import * as vscode from 'vscode';
import type { SlashCommand, ParsedCommand, CommandContext } from '../types';
import { getModelCatalogService } from '../../../services/modelCatalogService';
import { PROVIDERS, getProvider } from '../../../models/catalog';
import type { ProviderId } from '../../../types/configuration';

export function createProviderCommands(): SlashCommand[] {
  const providersCommand: SlashCommand = {
    name: 'providers',
    aliases: ['endpoints'],
    description: 'List LLM providers and their configuration status',
    category: 'provider',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const config = ctx.services.config;
      const lines: string[] = ['**LLM Providers**', ''];
      for (const p of PROVIDERS) {
        const source = await config.getProviderKeySource(p.id);
        const envVar = config.getProviderEnvVarInUse(p.id);
        let status: string;
        if (source === 'stored') status = '$(check) stored key';
        else if (source === 'env' && envVar) status = `$(check) env var \`$${envVar}\``;
        else status = `not configured · env: ${p.envVars.map(e => `\`$${e}\``).join(', ')}`;
        lines.push(`- **${p.displayName}** — ${status}`);
      }
      lines.push('');
      lines.push('Use `/provider new` to add a provider, or `/provider remove <id>` to remove one.');
      ctx.reply(lines.join('\n'));
    },
  };

  const providerCommand: SlashCommand = {
    name: 'provider',
    description: 'Add, remove, or inspect LLM providers',
    usage: '/provider [new|remove <id>]',
    category: 'provider',
    subcommands: [
      { name: 'new', description: 'Add a new provider (opens the setup flow)' },
      { name: 'remove', description: 'Remove a stored provider key' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.subcommand === 'new') {
        await vscode.commands.executeCommand('rqml-vscode.addLlmProvider');
        return;
      }
      if (parsed.subcommand === 'remove') {
        const id = parsed.args[0];
        if (id && isValidProviderId(id)) {
          const source = await ctx.services.config.getProviderKeySource(id);
          if (source !== 'stored') {
            ctx.reply(`Provider \`${id}\` has no stored key to remove.`);
            return;
          }
          await ctx.services.config.removeProviderApiKey(id);
          const active = ctx.services.config.getActiveModel();
          if (active && active.providerId === id) {
            await ctx.services.config.clearActiveModel();
          }
          ctx.reply(`Removed stored key for **${getProvider(id)?.displayName || id}**.`);
          return;
        }
        await vscode.commands.executeCommand('rqml-vscode.removeLlmProvider');
        return;
      }

      // No subcommand — show current active provider/model
      const active = ctx.services.config.getActiveModel();
      if (!active) {
        ctx.reply('No active model selected. Use `/provider new` to configure one, then `/model use` to pick a model.');
        return;
      }
      const provider = getProvider(active.providerId);
      ctx.reply(`Active: **${provider?.displayName || active.providerId}** — model \`${active.modelId}\``);
    },
  };

  const keysCommand: SlashCommand = {
    name: 'keys',
    aliases: ['key'],
    description: 'Show API key status for all providers',
    usage: '/keys [set|test]',
    category: 'provider',
    subcommands: [
      { name: 'set', description: 'Add/replace a provider\'s stored key' },
      { name: 'test', description: 'Test the active provider\'s key' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.subcommand === 'set') {
        await vscode.commands.executeCommand('rqml-vscode.addLlmProvider');
        return;
      }

      if (parsed.subcommand === 'test') {
        const active = ctx.services.config.getActiveModel();
        if (!active) {
          ctx.reply('No active model. Use `/model use` to select one.');
          return;
        }
        const key = await ctx.services.config.getProviderApiKey(active.providerId);
        if (!key) {
          ctx.reply(`No key available for \`${active.providerId}\`. Use \`/provider new\` to add one.`);
          return;
        }
        ctx.system('Testing provider connectivity…');
        try {
          const ready = await ctx.services.llm.isReady();
          ctx.reply(ready
            ? `Provider **${getProvider(active.providerId)?.displayName}** is ready.`
            : `Provider is not ready. Check your configuration.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          ctx.reply(`Provider test failed: ${msg}`);
        }
        return;
      }

      // Default — show key status per provider
      const config = ctx.services.config;
      const lines: string[] = ['**API Key Status**', ''];
      for (const p of PROVIDERS) {
        const source = await config.getProviderKeySource(p.id);
        if (source === 'stored') {
          const masked = await config.getProviderApiKeyMasked(p.id);
          lines.push(`- **${p.displayName}**: ${masked}  \`(stored)\``);
        } else if (source === 'env') {
          const envVar = config.getProviderEnvVarInUse(p.id);
          lines.push(`- **${p.displayName}**: $${envVar}  \`(env)\``);
        } else {
          lines.push(`- **${p.displayName}**: —`);
        }
      }
      ctx.reply(lines.join('\n'));
    },
  };

  const llmCommand: SlashCommand = {
    name: 'llm',
    description: 'Quick LLM status — shows active provider, model, and readiness',
    category: 'provider',

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const active = ctx.services.config.getActiveModel();
      const ready = await ctx.services.llm.isReady();

      const lines: string[] = [];
      if (active) {
        const catalog = getModelCatalogService();
        const provider = catalog.getProviderEntry(active.providerId);
        lines.push(`**${provider?.displayName || active.providerId}** — model \`${active.modelId}\``);
        lines.push(`Status: ${ready ? 'ready' : 'not ready'}`);
      } else {
        lines.push('No active model.');
        lines.push('Use `/provider new` to add a provider, then `/model use` to pick a model.');
      }
      ctx.reply(lines.join('\n'));
    },
  };

  return [providersCommand, providerCommand, keysCommand, llmCommand];
}

function isValidProviderId(id: string): id is ProviderId {
  return PROVIDERS.some(p => p.id === id);
}
