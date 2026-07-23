// Deterministic reports, rendered from @rqml/core.
//
// These replace slash commands that asked a language model to assess the
// specification. A model's answer is not reproducible and can contradict the
// gate — and one of them measurably did: `/sync` counted a requirement as
// "traced" if ANY edge touched it, so on this repository it reported 37
// untraced while the engine reported 142 orphans and 148 unverified. Two
// numbers for the same question, from the same document, in the same window.
//
// Narration by a model is still available where it adds something a number
// cannot, but it is now opt-in behind `--full` and sits beside the deterministic
// answer rather than replacing it.
//
// Kept free of any `vscode` import so every report can be unit-tested.

import type { CoverageReport, Diagnostic, DriftReport, RqmlDocument } from '../core';

/** Core's lint vocabulary is narrower than the extension's four levels. */
export type CoreLintStrictness = 'lenient' | 'standard' | 'strict';

/**
 * Map the project's strictness onto core's lint vocabulary.
 *
 * `certified` has no counterpart — core's strictest lint posture is `strict` —
 * so it maps there rather than silently falling back to the default, which
 * would make the most demanding level lint the least strictly.
 */
export function toLintStrictness(level: string): CoreLintStrictness {
  switch (level) {
    case 'relaxed':
      return 'lenient';
    case 'strict':
    case 'certified':
      return 'strict';
    default:
      return 'standard';
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function bullets(items: readonly string[], limit = 15): string[] {
  const shown = items.slice(0, limit).map((i) => `  - \`${i}\``);
  if (items.length > limit) {shown.push(`  - …and ${items.length - limit} more`);}
  return shown;
}

function severityOf(d: Diagnostic): 'error' | 'warning' | 'info' {
  return d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info';
}

/** Group diagnostics by severity, most severe first, capped for readability. */
export function renderDiagnostics(diagnostics: readonly Diagnostic[], limit = 20): string[] {
  if (diagnostics.length === 0) {return [];}
  const lines: string[] = [];
  for (const severity of ['error', 'warning', 'info'] as const) {
    const group = diagnostics.filter((d) => severityOf(d) === severity);
    if (group.length === 0) {continue;}
    lines.push('', `**${severity[0].toUpperCase() + severity.slice(1)}s** (${group.length}):`);
    for (const d of group.slice(0, limit)) {
      const where = d.line ? `L${d.line}: ` : '';
      const rule = d.rule ? ` \`${d.rule}\`` : '';
      lines.push(`  - ${where}${d.message}${rule}`);
    }
    if (group.length > limit) {lines.push(`  - …and ${group.length - limit} more`);}
  }
  return lines;
}

/**
 * `/status` — what the document contains and how well it is covered.
 *
 * The coverage figures are the engine's, so they agree with the status bar and
 * with `rqml check`. The previous implementation counted view-model items and
 * reported "Diagnostics: clean" from whatever happened to be in the Problems
 * panel, which is a different question entirely.
 */
export function renderStatus(
  doc: RqmlDocument,
  coverage: CoverageReport,
  drift: DriftReport,
  strictness: string
): string {
  const lines: string[] = [
    `**${doc.meta?.title ?? doc.docId}**`,
    '',
    `\`${doc.docId}\` · schema ${doc.version} · status ${doc.status} · strictness ${strictness}`,
    '',
    '**Coverage**',
    `  - ${plural(coverage.requirements.length, 'requirement')}`,
    `  - ${plural(coverage.uncoveredGoals.length, 'goal')} with no incoming \`satisfies\` edge`,
    `  - ${plural(coverage.orphanRequirements.length, 'requirement')} satisfying no goal or scenario`,
    `  - ${plural(coverage.unverifiedRequirements.length, 'requirement')} with no verification edge`,
    `  - ${plural(coverage.unimplementedApprovedRequirements.length, 'approved requirement')} with no implementation`,
  ];

  if (coverage.prematureImplementations.length > 0) {
    lines.push(
      `  - ${plural(coverage.prematureImplementations.length, 'implementation')} of a requirement that is not approved`
    );
  }

  lines.push('', '**Implementation links**', `  - ${plural(drift.links.length, 'link')} recorded`);
  if (drift.drifted.length > 0) {
    lines.push(`  - ${plural(drift.drifted.length, 'link')} drifted since baseline:`);
    lines.push(...bullets(drift.drifted.map((d) => `${d.edgeId} → ${d.uri} (${d.status})`)));
  } else {
    lines.push('  - none drifted');
  }

  lines.push(
    '',
    '_Computed from @rqml/core — the same figures `rqml check` uses._',
    '_Use `/status --full` for a language-model assessment alongside these._'
  );
  return lines.join('\n');
}

/** `/lint` — the engine's semantic lint, not a model's impression of one. */
export function renderLint(findings: readonly Diagnostic[], strictness: CoreLintStrictness): string {
  if (findings.length === 0) {
    return `**Lint** — no findings at \`${strictness}\` strictness.`;
  }
  const lines = [`**Lint** — ${plural(findings.length, 'finding')} at \`${strictness}\` strictness.`];
  lines.push(...renderDiagnostics(findings));
  lines.push('', '_Use `/lint --full` for a language-model review alongside these._');
  return lines.join('\n');
}

/**
 * `/sync` — how far the specification and the codebase have diverged.
 *
 * The figures below are the ones the gate acts on. The previous implementation
 * treated any edge as coverage, so on this repository 114 of 172 edges — every
 * `dependsOn` and `refines` — counted as "traced" while contributing nothing to
 * implementation or verification coverage.
 */
export function renderSync(coverage: CoverageReport, drift: DriftReport): string {
  const lines: string[] = ['**Spec ↔ code sync**', ''];

  lines.push(
    `  - ${plural(coverage.unimplementedApprovedRequirements.length, 'approved requirement')} with no implementation link`
  );
  if (coverage.unimplementedApprovedRequirements.length > 0) {
    lines.push(...bullets(coverage.unimplementedApprovedRequirements));
  }

  lines.push(
    '',
    `  - ${plural(coverage.unverifiedRequirements.length, 'requirement')} with no verification link`
  );
  if (coverage.unverifiedRequirements.length > 0) {
    lines.push(...bullets(coverage.unverifiedRequirements));
  }

  lines.push('', `  - ${plural(drift.drifted.length, 'implementation')} changed since baseline`);
  if (drift.drifted.length > 0) {
    lines.push(...bullets(drift.drifted.map((d) => `${d.edgeId} → ${d.uri}`)));
    lines.push('', '_Re-pin a reviewed change with the quick fix on its diagnostic._');
  }

  if (coverage.prematureImplementations.length > 0) {
    lines.push(
      '',
      `  - ${plural(coverage.prematureImplementations.length, 'implementation')} of a non-approved requirement`
    );
    lines.push(
      ...bullets(coverage.prematureImplementations.map((p) => `${p.edgeId} → ${p.requirementId}`))
    );
  }

  lines.push('', '_Use `/sync scan` for a language-model review of unlinked code._');
  return lines.join('\n');
}

/**
 * `/trace` — the trace neighbourhood of one artifact.
 *
 * Rendered from the engine's resolved edges rather than the view model, whose
 * `TraceEdge` flattens endpoints to plain strings and sets them to `''` for
 * anything that is not a local id. That erased every external endpoint —
 * including every `implements` edge, which is precisely what a trace query is
 * usually asked about.
 */
export function renderTrace(
  id: string,
  edges: readonly {
    edge: { id: string; type: string };
    from: { locator: unknown };
    to: { locator: unknown };
  }[],
  describe: (locator: unknown) => string
): string {
  const incoming = edges.filter((e) => describe(e.to.locator) === id);
  const outgoing = edges.filter((e) => describe(e.from.locator) === id);

  if (incoming.length === 0 && outgoing.length === 0) {
    return `**\`${id}\`** — no trace edges reference this artifact.`;
  }

  const lines = [`**Trace for \`${id}\`**`, ''];
  if (outgoing.length > 0) {
    lines.push(`**Outgoing** (${outgoing.length}):`);
    for (const e of outgoing) {
      lines.push(`  - \`${e.edge.type}\` → \`${describe(e.to.locator)}\`  _(${e.edge.id})_`);
    }
    lines.push('');
  }
  if (incoming.length > 0) {
    lines.push(`**Incoming** (${incoming.length}):`);
    for (const e of incoming) {
      lines.push(`  - \`${describe(e.from.locator)}\` → \`${e.edge.type}\`  _(${e.edge.id})_`);
    }
  }
  return lines.join('\n');
}

/**
 * A human-readable form of any locator kind.
 *
 * The whole point of routing through this is that a non-local endpoint renders
 * as its URI rather than as an empty string.
 */
export function describeLocator(locator: unknown): string {
  const l = locator as { kind?: string; id?: string; uri?: string; docUri?: string };
  if (l?.kind === 'local') {return l.id ?? '';}
  if (l?.kind === 'external') {return l.uri ?? '';}
  if (l?.kind === 'doc') {return `${l.docUri ?? ''}#${l.id ?? ''}`;}
  return l?.id ?? l?.uri ?? '';
}
