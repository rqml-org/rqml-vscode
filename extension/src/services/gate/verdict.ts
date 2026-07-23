// REQ-GATE-001: the deterministic verdict.
// REQ-GATE-002: no language model anywhere in this path.
//
// This composes @rqml/core exactly as `rqml check` composes it. The ordering
// and the conditionals below are not stylistic — each one changes the verdict:
//
//   * integrity runs ONLY when validation passed. Running it unconditionally
//     reports a duplicate id twice under 2.2.0, because the schema's xs:unique
//     now fires as well.
//   * coverage blocks only at strict and certified. At standard it is computed
//     and surfaced, but does not fail the gate.
//   * exactly FIVE coverage arrays are counted. `unimplementedRequirements` is
//     reported but deliberately not counted — counting it would make the editor
//     stricter than the gate of record, so a repository could pass CI and fail
//     in the editor.
//
// Verified against the compiled output of the published @rqml/cli 0.10.0, not
// against the monorepo source, which is ahead of the published packages: its
// working tree adds a `contextChanged` drift class that @rqml/core 0.8.0 does
// not expose. When that ships, this module must be updated in step or the two
// will disagree — which is the one thing REQ-GATE-001 forbids.
//
// Kept free of any `vscode` import so the verdict can be unit-tested without an
// extension host.

import { loadCore, loadValidate, type CoverageReport, type Diagnostic, type DriftFinding } from '../core';

export type GateStrictness = 'relaxed' | 'standard' | 'strict' | 'certified';

/** Exit codes, matching `@rqml/cli`'s so a task's problem matcher agrees. */
export const GATE_EXIT = {
  OK: 0,
  /** Not well-formed, schema-invalid, or failing referential integrity. */
  VALIDATION: 1,
  /** Blocking drift or coverage. */
  CHECK: 2,
} as const;

export interface GateVerdict {
  verdict: 'pass' | 'fail';
  strictness: GateStrictness;
  /** Matches the exit code `rqml check` would return for the same input. */
  exitCode: (typeof GATE_EXIT)[keyof typeof GATE_EXIT];
  schemaVersion?: string;
  /** Every diagnostic the gate would print, in the order it prints them. */
  diagnostics: Diagnostic[];
  /** Implements links whose artifact is missing or has changed since baseline. */
  drifted: DriftFinding[];
  coverage?: CoverageReport;
  /** True when coverage findings are counted at this strictness. */
  coverageBlocks: boolean;
}

/** Coverage findings block the gate at strict and certified only. */
export function coverageBlocks(strictness: GateStrictness): boolean {
  return strictness === 'strict' || strictness === 'certified';
}

export interface EvaluateOptions {
  /** The spec's own directory — code links and the baseline resolve against it. */
  baseDir: string;
  strictness: GateStrictness;
}

/**
 * Evaluate the gate for one specification's text.
 *
 * `baseDir` must be the specification's own directory, not the workspace root:
 * relative implementation locators and `.rqml/baseline.json` both resolve
 * per-unit, which is what makes a monorepo's units independent.
 */
export async function evaluate(xml: string, options: EvaluateOptions): Promise<GateVerdict> {
  const { baseDir, strictness } = options;
  const core = await loadCore();
  const { validate } = await loadValidate();

  const validation = validate(xml);
  const integrity = validation.valid ? core.checkIntegrity(xml) : [];

  const parsed = core.parse(xml);
  const coverage = parsed.ok ? core.computeCoverage(parsed.document) : undefined;

  const driftOptions: Parameters<typeof core.detectDrift>[1] = { baseDir };
  const baseline = core.loadBaseline(baseDir);
  if (baseline !== undefined) driftOptions.baseline = baseline;
  const drift = parsed.ok ? core.detectDrift(parsed.document, driftOptions) : undefined;

  const validationFailed = !validation.valid || integrity.length > 0;
  const driftFailed = (drift?.drifted.length ?? 0) > 0;

  const coverageProblemCount =
    (coverage?.uncoveredGoals.length ?? 0) +
    (coverage?.unverifiedRequirements.length ?? 0) +
    (coverage?.orphanRequirements.length ?? 0) +
    (coverage?.unimplementedApprovedRequirements.length ?? 0) +
    (coverage?.prematureImplementations.length ?? 0);

  const blocks = coverageBlocks(strictness);
  const coverageFailed = blocks && coverageProblemCount > 0;

  const verdict: 'pass' | 'fail' =
    validationFailed || driftFailed || coverageFailed ? 'fail' : 'pass';

  const diagnostics: Diagnostic[] = [
    ...validation.diagnostics,
    ...integrity,
    ...(drift?.diagnostics ?? []),
    ...(coverageFailed ? (coverage?.diagnostics ?? []) : []),
  ];

  const exitCode = validationFailed
    ? GATE_EXIT.VALIDATION
    : driftFailed || coverageFailed
      ? GATE_EXIT.CHECK
      : GATE_EXIT.OK;

  return {
    verdict,
    strictness,
    exitCode,
    schemaVersion: validation.schemaVersion,
    diagnostics,
    drifted: drift?.drifted ?? [],
    coverage,
    coverageBlocks: blocks,
  };
}

/** A one-line summary for the status bar, in the CLI's own phrasing. */
export function summarise(v: GateVerdict): string {
  return `${v.verdict === 'pass' ? '✓' : '✗'} check ${v.verdict} (${v.strictness})`;
}
