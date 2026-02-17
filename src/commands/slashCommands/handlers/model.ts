// REQ-MDL-008: /models catalog command
// REQ-MDL-009: /model use command
// REQ-MDL-010: /model test connectivity command

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';
import { getModelCatalogService } from '../../../services/modelCatalogService';

export function createModelCommands(): SlashCommand[] {
  /**
   * REQ-MDL-008: /models — list catalog entries for the active provider (or all with --all).
   */
  const modelsCommand: SlashCommand = {
    name: 'models',
    description: 'List models in the catalog for the active provider (--all for all providers)',
    usage: '/models [--all]',
    category: 'provider',

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const config = ctx.services.config;
      const catalogService = getModelCatalogService();
      const endpoint = config.getActiveEndpoint();

      if (!endpoint) {
        ctx.reply('No active endpoint configured. Use `/providers` to list or add one.');
        return;
      }

      const showAll = parsed.flags.has('all');
      const available = await catalogService.getAvailableCatalog();
      const catalog = showAll
        ? available
        : available.filter(e => e.provider === endpoint.provider);

      if (catalog.length === 0) {
        ctx.reply(`No models in catalog${showAll ? '' : ` for provider "${endpoint.provider}"`}.`);
        return;
      }

      const currentModelId = catalogService.getSelectedModelId(endpoint);

      // REQ-MDL-008 AC-MDL-008-03: Group by provider when --all
      const lines: string[] = [];
      if (showAll) {
        lines.push('**Model Catalog (all providers)**', '');
        const byProvider = new Map<string, typeof catalog>();
        for (const entry of catalog) {
          const list = byProvider.get(entry.provider) || [];
          list.push(entry);
          byProvider.set(entry.provider, list);
        }
        for (const [provider, models] of byProvider) {
          lines.push(`### ${provider}`);
          for (const m of models) {
            const active = m.modelId === currentModelId && m.provider === endpoint.provider
              ? ' **\\***' : '';
            const caps = m.capabilities.join(', ');
            const ctx_ = m.contextWindow > 0
              ? `${Math.round(m.contextWindow / 1000)}k`
              : '?';
            lines.push(`- \`${m.modelId}\` — ${m.displayName} (${ctx_} ctx, ${caps})${active}`);
          }
          lines.push('');
        }
      } else {
        lines.push(`**Models for ${endpoint.provider}**`, '');
        for (const m of catalog) {
          // REQ-MDL-008 AC-MDL-008-02: Mark active
          const active = m.modelId === currentModelId ? ' **\\***' : '';
          const caps = m.capabilities.join(', ');
          const ctx_ = m.contextWindow > 0
            ? `${Math.round(m.contextWindow / 1000)}k`
            : '?';
          const rec = m.recommended ? ' _(recommended)_' : '';
          lines.push(`- \`${m.modelId}\` — ${m.displayName} (${ctx_} ctx, ${caps})${rec}${active}`);
        }
      }

      ctx.reply(lines.join('\n'));
    },
  };

  /**
   * REQ-MDL-009: /model use — set active model or open QuickPick.
   */
  const modelCommand: SlashCommand = {
    name: 'model',
    description: 'Switch the active model for the current endpoint',
    usage: '/model use [<model-id>]',
    category: 'provider',
    subcommands: [
      { name: 'use', description: 'Set the active model (or open picker if no argument)' },
      { name: 'test', description: 'Test connectivity for the active (or specified) model' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const config = ctx.services.config;
      const catalogService = getModelCatalogService();
      const endpoint = config.getActiveEndpoint();

      if (!endpoint) {
        ctx.reply('No active endpoint configured.');
        return;
      }

      if (parsed.subcommand === 'use') {
        const query = parsed.args.join(' ');

        if (!query) {
          // REQ-MDL-009 AC-MDL-009-02: Open QuickPick when no argument
          const picked = await catalogService.showModelPicker(endpoint);
          if (picked) {
            ctx.reply(`Switched to model **${picked.displayName}** (\`${picked.modelId}\`, ${picked.provider}).`);
          }
          return;
        }

        // REQ-MDL-009 AC-MDL-009-01: Exact match (scoped to available models)
        const available = await catalogService.getAvailableCatalog();
        const lower = query.toLowerCase();
        const exact = available.find(e => e.modelId.toLowerCase() === lower);
        if (exact) {
          await catalogService.selectModelEntry(exact, endpoint);
          ctx.reply(`Switched to model **${exact.displayName}** (\`${exact.modelId}\`, ${exact.provider}).`);
          return;
        }

        // REQ-MDL-009 AC-MDL-009-03: Partial match / disambiguation
        const matches = available.filter(
          e => e.modelId.toLowerCase().includes(lower) ||
               e.displayName.toLowerCase().includes(lower)
        );
        if (matches.length === 1) {
          await catalogService.selectModelEntry(matches[0], endpoint);
          ctx.reply(`Switched to model **${matches[0].displayName}** (\`${matches[0].modelId}\`, ${matches[0].provider}).`);
          return;
        }

        if (matches.length > 1) {
          const list = matches.map(m => `\`${m.modelId}\` (${m.displayName}, ${m.provider})`).join(', ');
          ctx.reply(`Multiple matches for "${query}": ${list}\nPlease be more specific.`);
          return;
        }

        // REQ-MDL-009 AC-MDL-009-04: No match — suggest similar
        const suggestions = available.slice(0, 3).map(m => `\`${m.modelId}\``).join(', ');
        ctx.reply(`No model matching "${query}" in available providers. Try: ${suggestions}`);
        return;
      }

      if (parsed.subcommand === 'test') {
        // REQ-MDL-010: /model test
        const targetId = parsed.args.join(' ') || catalogService.getSelectedModelId(endpoint);
        if (!targetId) {
          ctx.reply('No model selected. Use `/model use` to select one.');
          return;
        }

        const apiKey = await config.getEndpointApiKey(endpoint.id);
        if (!apiKey) {
          ctx.reply(`No API key for **${endpoint.name}**. Use \`/keys set\`.`);
          return;
        }

        ctx.system(`Testing model "${targetId}" on ${endpoint.provider}...`);
        const start = Date.now();
        try {
          const { generateText } = await import('ai');
          const model = await catalogService.createModelFromCatalog(
            endpoint.provider, targetId, apiKey
          );
          await generateText({
            model,
            prompt: 'Say "ok".',
            maxOutputTokens: 5,
          });
          const latency = Date.now() - start;
          ctx.reply(`Model \`${targetId}\` is reachable. Latency: ${latency}ms.`);
        } catch (err) {
          const latency = Date.now() - start;
          const msg = err instanceof Error ? err.message : String(err);
          ctx.reply(
            `Model \`${targetId}\` test failed (${latency}ms): ${msg}\n` +
            'Check your API key, network, and model availability.'
          );
        }
        return;
      }

      // No subcommand — show current model
      const modelId = catalogService.getSelectedModelId(endpoint);
      const entry = catalogService.findModel(modelId, endpoint.provider);
      if (entry) {
        const caps = entry.capabilities.join(', ');
        const ctxSize = entry.contextWindow > 0
          ? `${Math.round(entry.contextWindow / 1000)}k`
          : '?';
        ctx.reply(
          `**Active model:** ${entry.displayName} (\`${entry.modelId}\`)\n` +
          `Provider: ${entry.provider} | Context: ${ctxSize} tokens | Capabilities: ${caps}`
        );
      } else {
        ctx.reply(`**Active model:** \`${modelId}\` (not in catalog)\nProvider: ${endpoint.provider}`);
      }
    },
  };

  return [modelsCommand, modelCommand];
}
