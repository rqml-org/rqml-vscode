// REQ-CMD-007: Spec quality and health commands

import * as vscode from 'vscode';
import type { SlashCommand, ParsedCommand, CommandContext } from '../types';

/**
 * Count items recursively in an RqmlSection
 */
function countItems(items: Array<{ children?: unknown[] }>): number {
  let count = 0;
  for (const item of items) {
    count++;
    if (item.children && Array.isArray(item.children)) {
      count += countItems(item.children as Array<{ children?: unknown[] }>);
    }
  }
  return count;
}

export function createQualityCommands(): SlashCommand[] {
  const statusCommand: SlashCommand = {
    name: 'status',
    description: 'Show spec summary (or full LLM-based assessment with --full)',
    usage: '/status [--full]',
    category: 'quality',
    requiresSpec: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const isFull = parsed.flags.has('full');

      if (isFull) {
        // LLM-streaming quality assessment
        const llm = ctx.services.llm;
        if (!(await llm.isReady())) {
          ctx.reply('`--full` requires a configured LLM endpoint.');
          return;
        }
        await ctx.streamPrompt(
          '[SYSTEM] Please provide a comprehensive quality assessment of the current RQML specification. ' +
          'Cover: completeness, traceability coverage, requirement quality (atomicity, testability, unambiguity), ' +
          'section presence, and any structural issues. Format as a concise report.'
        );
        return;
      }

      // Local summary from parsed spec
      const doc = ctx.services.spec.state.document!;
      const lines: string[] = ['**Spec Status**', ''];
      lines.push(`Document: \`${doc.docId}\` (v${doc.version})`);
      lines.push(`Status: ${doc.status}`);
      lines.push('');

      lines.push('**Sections:**');
      for (const [name, section] of doc.sections) {
        if (section.present) {
          const count = countItems(section.items);
          lines.push(`  ${name}: ${count} item${count !== 1 ? 's' : ''}`);
        } else {
          lines.push(`  ${name}: _(empty)_`);
        }
      }

      lines.push('');
      lines.push(`**Trace edges:** ${doc.traceEdges.length}`);

      // Show diagnostics count if any
      const specUri = doc.uri;
      const diags = vscode.languages.getDiagnostics(specUri);
      if (diags.length > 0) {
        const errors = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
        const warnings = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
        const info = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Information).length;
        lines.push(`**Diagnostics:** ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}, ${info} info`);
      } else {
        lines.push('**Diagnostics:** clean');
      }

      ctx.reply(lines.join('\n'));
    },
  };

  const validateCommand: SlashCommand = {
    name: 'validate',
    description: 'Run full validation (XML, XSD, semantic) and show results',
    category: 'quality',
    requiresSpec: true,

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      const doc = ctx.services.spec.state.document!;
      ctx.system('Running validation...');

      // Find the TextDocument for the spec URI
      const textDoc = await vscode.workspace.openTextDocument(doc.uri);
      await ctx.services.diagnostics.validateDocument(textDoc);

      const diags = vscode.languages.getDiagnostics(doc.uri);

      if (diags.length === 0) {
        ctx.reply('Validation passed — no issues found.');
        return;
      }

      const lines: string[] = [`**Validation Results** — ${diags.length} issue${diags.length !== 1 ? 's' : ''}`, ''];

      const bySeverity = {
        errors: diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error),
        warnings: diags.filter(d => d.severity === vscode.DiagnosticSeverity.Warning),
        info: diags.filter(d => d.severity === vscode.DiagnosticSeverity.Information),
      };

      for (const [label, items] of Object.entries(bySeverity)) {
        if (items.length === 0) continue;
        lines.push(`**${label.charAt(0).toUpperCase() + label.slice(1)}** (${items.length}):`);
        for (const d of items.slice(0, 20)) {
          lines.push(`  L${d.range.start.line + 1}: ${d.message}`);
        }
        if (items.length > 20) {
          lines.push(`  ... and ${items.length - 20} more`);
        }
        lines.push('');
      }

      ctx.reply(lines.join('\n'));
    },
  };

  const lintCommand: SlashCommand = {
    name: 'lint',
    description: 'Run semantic checks and report quality issues',
    usage: '/lint',
    category: 'quality',
    requiresSpec: true,
    requiresLlm: true,

    async execute(_parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      await ctx.streamPrompt(
        '[SYSTEM] Please perform a detailed semantic lint of the current RQML specification. ' +
        'Check for: vague language (should/could without criteria), non-atomic requirements, ' +
        'untestable acceptance criteria, missing trace edges, orphan requirements, ' +
        'naming convention violations, and structural issues. ' +
        'Format as a categorised list of findings with severity (error/warning/info).'
      );
    },
  };

  const scoreCommand: SlashCommand = {
    name: 'score',
    description: 'Rate the spec quality on multiple dimensions (--full for detailed report)',
    usage: '/score [--full]',
    category: 'quality',
    requiresSpec: true,
    requiresLlm: true,

    async execute(parsed: ParsedCommand, ctx: CommandContext): Promise<void> {
      if (parsed.flags.has('full')) {
        await ctx.streamPrompt(
          '[SYSTEM] Please score the current RQML specification on the following dimensions (1-10 each): ' +
          '1. Completeness — are all relevant requirements captured? ' +
          '2. Traceability — are all requirements properly traced to goals, tests, and code? ' +
          '3. Quality — are requirements atomic, testable, and unambiguous? ' +
          '4. Structure — does the document follow RQML best practices? ' +
          '5. Consistency — are naming conventions and patterns consistent? ' +
          'Provide a detailed justification for each score with specific examples, ' +
          'a prioritised list of improvements, and an overall summary.'
        );
      } else {
        await ctx.streamPrompt(
          '[SYSTEM] Please give a concise quality scorecard for the current RQML specification. ' +
          'Score each dimension 1-10 on a single line: Completeness, Traceability, Quality, Structure, Consistency. ' +
          'Format: "Dimension: X/10 — one-sentence reason". ' +
          'End with an overall score and one-line verdict.'
        );
      }
    },
  };

  return [statusCommand, validateCommand, lintCommand, scoreCommand];
}
