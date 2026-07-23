// REQ-CMD-007: Spec quality and health commands.
// REQ-GATE-001/002: these report the engine's verdict, not a model's opinion.
//
// /status, /validate and /lint used to answer checkable questions with either a
// re-derived view-model count or a language-model prompt. Both can contradict
// the gate, which is the one thing this product must never do. They are now
// computed from @rqml/core; model narration remains available behind --full,
// beside the deterministic answer rather than instead of it.

import * as path from 'path';
import type { SlashCommand, ParsedCommand, CommandContext } from '../types';
import { loadCore } from '../../../services/core';
import { resolveStrictness } from '../../../services/strictnessService';
import { evaluate } from '../../../services/gate/verdict';
import {
  renderDiagnostics,
  renderLint,
  renderStatus,
  toLintStrictness,
} from '../../../services/report/specReports';
import { analyseActiveSpec } from '../specAnalysis';

export function createQualityCommands(): SlashCommand[] {
  const statusCommand: SlashCommand = {
    name: 'status',
    description: 'Show spec coverage and drift (add --full for a model assessment)',
    usage: '/status [--full]',
    category: 'quality',
    requiresSpec: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const analysis = await analyseActiveSpec();
      if (typeof analysis === 'string') {
        ctx.reply(analysis);
        return;
      }

      const strictness = await resolveStrictness();
      ctx.reply(renderStatus(analysis.document, analysis.coverage, analysis.drift, strictness));

      // The model assessment is now an addition to the figures, not a
      // replacement for them, so the two can never be read as alternatives.
      if (parsed.flags.has('full')) {
        if (!(await ctx.services.llm.isReady())) {
          ctx.reply('`--full` also needs a configured model; the figures above do not.');
          return;
        }
        await ctx.streamPrompt(
          '[SYSTEM] The deterministic coverage and drift figures have already been shown to the user. ' +
          'Do not restate them and do not contradict them. Comment only on what a number cannot capture: ' +
          'requirement quality (atomicity, testability, unambiguity), gaps in intent, and what to do next.'
        );
      }
    },
  };

  const validateCommand: SlashCommand = {
    name: 'validate',
    description: 'Run the gate: schema, integrity, coverage and drift',
    category: 'quality',
    requiresSpec: true,

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const analysis = await analyseActiveSpec();
      if (typeof analysis === 'string') {
        ctx.reply(analysis);
        return;
      }

      ctx.system('Running the gate…');
      const strictness = await resolveStrictness();
      const verdict = await evaluate(analysis.xml, { baseDir: analysis.baseDir, strictness });

      const headline =
        verdict.verdict === 'pass'
          ? `✓ check pass (${verdict.strictness}) — schema ${verdict.schemaVersion ?? 'unknown'}`
          : `✗ check fail (${verdict.strictness}) — ${verdict.diagnostics.length} finding(s)`;

      const lines = [`**${headline}**`];
      lines.push(...renderDiagnostics(verdict.diagnostics));
      lines.push(
        '',
        '_This is the same verdict `rqml check` produces, and the same one the status bar shows._'
      );
      ctx.reply(lines.join('\n'));
    },
  };

  const lintCommand: SlashCommand = {
    name: 'lint',
    description: 'Run the engine’s semantic lint (add --full for a model review)',
    usage: '/lint [--full]',
    category: 'quality',
    requiresSpec: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const analysis = await analyseActiveSpec();
      if (typeof analysis === 'string') {
        ctx.reply(analysis);
        return;
      }

      const core = await loadCore();
      const strictness = toLintStrictness(await resolveStrictness());
      // adrDir lets the ADR-reference rule run; without it that rule is skipped.
      const findings = core.lint(analysis.document, {
        strictness,
        adrDir: path.join(analysis.baseDir, '.rqml', 'adr'),
      });

      ctx.reply(renderLint(findings, strictness));

      if (parsed.flags.has('full')) {
        if (!(await ctx.services.llm.isReady())) {
          ctx.reply('`--full` also needs a configured model; the findings above do not.');
          return;
        }
        await ctx.streamPrompt(
          '[SYSTEM] The engine’s lint findings have already been shown to the user. ' +
          'Do not restate them. Review what the rules cannot check: vague or non-atomic statements, ' +
          'untestable acceptance criteria, and requirements whose wording will not survive review.'
        );
      }
    },
  };

  const scoreCommand: SlashCommand = {
    name: 'score',
    description: 'Rate spec quality (a model judgement, anchored to the real figures)',
    usage: '/score [--full]',
    category: 'quality',
    requiresSpec: true,
    requiresLlm: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      // Scoring is a judgement, so it stays a model task — but it is anchored
      // to the measured figures so the score cannot silently disagree with them.
      const analysis = await analyseActiveSpec();
      if (typeof analysis === 'string') {
        ctx.reply(analysis);
        return;
      }

      const c = analysis.coverage;
      const measured =
        `Measured: ${c.requirements.length} requirements, ` +
        `${c.uncoveredGoals.length} uncovered goals, ` +
        `${c.orphanRequirements.length} orphans, ` +
        `${c.unverifiedRequirements.length} unverified, ` +
        `${c.unimplementedApprovedRequirements.length} approved-but-unimplemented, ` +
        `${analysis.drift.drifted.length} drifted implementations.`;

      ctx.reply(`_${measured}_`);
      await ctx.streamPrompt(
        `[SYSTEM] ${measured} These figures come from the engine and are not in dispute — ` +
        'use them, do not recompute or contradict them. ' +
        (parsed.flags.has('full')
          ? 'Score the specification 1-10 on Completeness, Traceability, Quality, Structure and Consistency, ' +
            'justifying each against the figures and against the document’s wording, then give a prioritised ' +
            'list of improvements.'
          : 'Give a one-line score per dimension (Completeness, Traceability, Quality, Structure, Consistency) ' +
            'and a one-line overall verdict.')
      );
    },
  };

  return [statusCommand, validateCommand, lintCommand, scoreCommand];
}
