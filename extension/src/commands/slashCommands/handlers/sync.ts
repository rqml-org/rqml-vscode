// REQ-CMD-008: Sync and traceability commands.
// REQ-GATE-001/002: the figures here are the engine's, so they agree with the gate.
//
// Two defects motivated the rewrite, both measured on this repository:
//
//  * /sync counted a requirement as "traced" if ANY edge touched it, so 114 of
//    172 edges — every dependsOn and refines — counted as coverage while
//    contributing nothing to implementation or verification. It reported 37
//    untraced where the engine reports 142 orphans and 148 unverified. Two
//    answers to the same question, from the same document, in the same window.
//
//  * /trace read the view model, whose TraceEdge flattens endpoints to strings
//    and sets them to '' for anything that is not a local id. That erased all 19
//    external endpoints — including every implements edge, which is exactly what
//    a trace query is usually asked about.

import type { SlashCommand, ParsedCommand, CommandContext } from '../types';
import { loadCore } from '../../../services/core';
import { describeLocator, renderSync, renderTrace } from '../../../services/report/specReports';
import { analyseActiveSpec } from '../specAnalysis';

export function createSyncCommands(): SlashCommand[] {
  const syncCommand: SlashCommand = {
    name: 'sync',
    description: 'Show spec-code divergence: unimplemented, unverified, drifted',
    usage: '/sync [status|scan]',
    category: 'sync',
    requiresSpec: true,
    subcommands: [
      { name: 'status', description: 'Coverage and drift, computed by the engine' },
      { name: 'scan', description: 'Model review of code the spec does not cover' },
    ],

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const analysis = await analyseActiveSpec();
      if (typeof analysis === 'string') {
        ctx.reply(analysis);
        return;
      }

      // The deterministic answer is always shown, including before a scan, so a
      // model's narrative can never stand in for the measurement.
      ctx.reply(renderSync(analysis.coverage, analysis.drift));

      if (parsed.subcommand === 'scan') {
        if (!(await ctx.services.llm.isReady())) {
          ctx.reply('`/sync scan` also needs a configured model; the figures above do not.');
          return;
        }
        await ctx.streamPrompt(
          '[SYSTEM] The engine has already reported which requirements lack implementation or ' +
          'verification links, and which implementations have drifted. Those figures are shown to ' +
          'the user and are not in dispute — do not restate or contradict them. ' +
          'Look instead for what the trace graph cannot see: behaviour in the code that no ' +
          'requirement describes.'
        );
      }
    },
  };

  const traceCommand: SlashCommand = {
    name: 'trace',
    description: 'Show the trace neighbourhood of an artifact',
    usage: '/trace <ID>',
    category: 'sync',
    requiresSpec: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.args.length === 0) {
        ctx.reply('Usage: `/trace <ID>` — e.g. `/trace REQ-UI-001`');
        return;
      }

      const analysis = await analyseActiveSpec();
      if (typeof analysis === 'string') {
        ctx.reply(analysis);
        return;
      }

      const targetId = parsed.args[0];
      const core = await loadCore();
      // resolveTrace keeps each endpoint's locator intact, so an external
      // artifact renders as its path rather than as an empty string.
      const resolution = core.resolveTrace(analysis.document);

      ctx.reply(renderTrace(targetId, resolution.edges, describeLocator));
    },
  };

  const diffCommand: SlashCommand = {
    name: 'diff',
    description: 'Show implementations that changed since their baseline',
    usage: '/diff [--full]',
    category: 'sync',
    requiresSpec: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const analysis = await analyseActiveSpec();
      if (typeof analysis === 'string') {
        ctx.reply(analysis);
        return;
      }

      const { drifted, links } = analysis.drift;
      if (drifted.length === 0) {
        ctx.reply(
          `**No drift** — all ${links.length} implementation link(s) match their recorded baseline.`
        );
      } else {
        const lines = [`**${drifted.length} implementation(s) changed since baseline**`, ''];
        for (const d of drifted) {
          lines.push(`  - \`${d.edgeId}\` → \`${d.uri}\` (${d.status})`);
        }
        lines.push(
          '',
          '_Re-pin a change you have reviewed with the quick fix on its diagnostic, ' +
          'or `rqml link --refresh <edge-id>`._'
        );
        ctx.reply(lines.join('\n'));
      }

      if (parsed.flags.has('full')) {
        if (!(await ctx.services.llm.isReady())) {
          ctx.reply('`--full` also needs a configured model; the figures above do not.');
          return;
        }
        await ctx.streamPrompt(
          '[SYSTEM] The engine has already reported which implementations drifted from their ' +
          'baseline; those are shown to the user and are not in dispute. Explain what the changes ' +
          'likely mean for the requirements they implement, and whether each looks like a ' +
          'reviewed change to re-pin or a genuine divergence to fix.'
        );
      }
    },
  };

  return [syncCommand, traceCommand, diffCommand];
}
