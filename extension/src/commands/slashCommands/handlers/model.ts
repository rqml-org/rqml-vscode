// REQ-MDL-008: /models catalog command
// REQ-MDL-009: /model use command
// REQ-MDL-010: /model test connectivity command
// REQ-CFG-013: Singleton-per-provider architecture

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';
import { getModelCatalogService } from '../../../services/modelCatalogService';
import type { ModelCatalogEntry } from '../../../models/catalog';
import { getProvider } from '../../../models/catalog';
import type { ProviderId } from '../../../types/configuration';

export function createModelCommands(): SlashCommand[] {
  /**
   * REQ-MDL-008: /models — list models from providers with an available key.
   */
  const modelsCommand: SlashCommand = {
    name: 'models',
    description: 'List available models (from providers with an API key)',
    usage: '/models [--all]',
    category: 'provider',

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const catalogService = getModelCatalogService();
      const config = ctx.services.config;
      const showAll = parsed.flags.has('all');

      const catalog = showAll
        ? [...catalogService.getCatalog()]
        : await catalogService.getAvailableModels();

      if (catalog.length === 0) {
        ctx.reply(
          showAll
            ? 'The catalog is empty.'
            : 'No providers are configured. Use `/provider new` to add one.'
        );
        return;
      }

      const active = config.getActiveModel();

      // Group by provider
      const byProvider = new Map<ProviderId, ModelCatalogEntry[]>();
      for (const entry of catalog) {
        const list = byProvider.get(entry.provider) || [];
        list.push(entry);
        byProvider.set(entry.provider, list);
      }

      const lines: string[] = [];
      lines.push(showAll ? '**Model Catalog (all providers)**' : '**Available Models**');
      lines.push('');
      for (const [providerId, models] of byProvider) {
        const provider = getProvider(providerId);
        lines.push(`### ${provider?.displayName || providerId}`);
        for (const m of models) {
          const isActive = active && active.providerId === m.provider && active.modelId === m.modelId;
          const caps = m.capabilities.join(', ');
          const ctxSize = m.contextWindow > 0
            ? `${Math.round(m.contextWindow / 1000)}k`
            : '?';
          const rec = m.recommended ? ' _(recommended)_' : '';
          const star = isActive ? ' **\\***' : '';
          lines.push(`- \`${m.modelId}\` — ${m.displayName} (${ctxSize} ctx, ${caps})${rec}${star}`);
        }
        lines.push('');
      }
      ctx.reply(lines.join('\n'));
    },
  };

  /**
   * REQ-MDL-009: /model use — set active model or open QuickPick.
   * REQ-MDL-010: /model test — check connectivity.
   */
  const modelCommand: SlashCommand = {
    name: 'model',
    description: 'Switch the active model',
    usage: '/model use [<model-id>]',
    category: 'provider',
    subcommands: [
      { name: 'use', description: 'Set the active model (or open picker if no argument)' },
      { name: 'test', description: 'Test connectivity for the active (or specified) model' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const catalogService = getModelCatalogService();
      const config = ctx.services.config;

      if (parsed.subcommand === 'use') {
        const query = parsed.args.join(' ');

        if (!query) {
          const picked = await catalogService.showModelPicker();
          if (picked) {
            ctx.reply(`Switched to **${picked.displayName}** (\`${picked.modelId}\`, ${picked.provider}).`);
          }
          return;
        }

        const available = await catalogService.getAvailableModels();
        const lower = query.toLowerCase();
        const exact = available.find(e => e.modelId.toLowerCase() === lower);
        if (exact) {
          await config.setActiveModel({ providerId: exact.provider, modelId: exact.modelId });
          ctx.reply(`Switched to **${exact.displayName}** (\`${exact.modelId}\`, ${exact.provider}).`);
          return;
        }

        const matches = available.filter(
          e => e.modelId.toLowerCase().includes(lower) ||
               e.displayName.toLowerCase().includes(lower)
        );
        if (matches.length === 1) {
          const m = matches[0];
          await config.setActiveModel({ providerId: m.provider, modelId: m.modelId });
          ctx.reply(`Switched to **${m.displayName}** (\`${m.modelId}\`, ${m.provider}).`);
          return;
        }

        if (matches.length > 1) {
          const list = matches.map(m => `\`${m.modelId}\` (${m.displayName}, ${m.provider})`).join(', ');
          ctx.reply(`Multiple matches for "${query}": ${list}\nPlease be more specific.`);
          return;
        }

        const suggestions = available.slice(0, 3).map(m => `\`${m.modelId}\``).join(', ');
        ctx.reply(`No model matching "${query}" in available providers. Try: ${suggestions || 'none'}`);
        return;
      }

      if (parsed.subcommand === 'test') {
        const active = config.getActiveModel();
        const queryTarget = parsed.args.join(' ').trim();
        let providerId: ProviderId | undefined;
        let modelId: string | undefined;

        if (queryTarget) {
          const m = catalogService.findModel(queryTarget);
          if (!m) {
            ctx.reply(`Model \`${queryTarget}\` not in catalog.`);
            return;
          }
          providerId = m.provider;
          modelId = m.modelId;
        } else {
          if (!active) {
            ctx.reply('No active model. Use `/model use` to select one.');
            return;
          }
          providerId = active.providerId;
          modelId = active.modelId;
        }

        const apiKey = await config.getProviderApiKey(providerId);
        if (!apiKey) {
          ctx.reply(`No key for provider \`${providerId}\`. Use \`/provider new\` to add one.`);
          return;
        }

        ctx.system(`Testing model \`${modelId}\` on ${providerId}…`);
        const start = Date.now();
        try {
          const { generateText } = await import('ai');
          const model = await catalogService.createModel(providerId, modelId, apiKey);
          await generateText({ model, prompt: 'Say "ok".', maxOutputTokens: 5 });
          const latency = Date.now() - start;
          ctx.reply(`Model \`${modelId}\` is reachable. Latency: ${latency}ms.`);
        } catch (err) {
          const latency = Date.now() - start;
          const msg = err instanceof Error ? err.message : String(err);
          ctx.reply(
            `Model \`${modelId}\` test failed (${latency}ms): ${msg}\n` +
            'Check your API key, network, and model availability.'
          );
        }
        return;
      }

      // No subcommand — show current model
      const active = config.getActiveModel();
      if (!active) {
        ctx.reply('No active model. Use `/model use` to select one, or `/provider new` to add a provider.');
        return;
      }
      const entry = catalogService.findModel(active.modelId, active.providerId);
      const providerName = getProvider(active.providerId)?.displayName || active.providerId;
      if (entry) {
        const caps = entry.capabilities.join(', ');
        const ctxSize = entry.contextWindow > 0
          ? `${Math.round(entry.contextWindow / 1000)}k`
          : '?';
        ctx.reply(
          `**Active model:** ${entry.displayName} (\`${entry.modelId}\`)\n` +
          `Provider: ${providerName} | Context: ${ctxSize} tokens | Capabilities: ${caps}`
        );
      } else {
        ctx.reply(`**Active model:** \`${active.modelId}\` (not in catalog)\nProvider: ${providerName}`);
      }
    },
  };

  return [modelsCommand, modelCommand];
}
