// Decides whether a proposed specification write may proceed.
//
// The rule is "no worse than it already is" rather than "must be perfect".
// Requiring a clean document would block the edit that repairs a broken one,
// which is exactly when a user most needs to write. So a write is refused when
// it would ADD errors, and allowed when it removes them or leaves them
// unchanged.
//
// Parse failure is absolute and separate: an unparseable specification cannot
// be repaired by any other tool in this extension, because every one of them
// begins by parsing.
//
// Kept free of any `vscode` import so the decision can be unit-tested against
// the real engine without an extension host.

import { loadCore, loadValidate, type Diagnostic } from '../core';

export type WriteDecision =
  | { allow: true; remaining: Diagnostic[] }
  | { allow: false; kind: 'unparseable' | 'introduces-errors'; introduced: Diagnostic[] };

/**
 * Validation and integrity errors for a candidate document.
 *
 * Integrity runs only when validation passed, mirroring the gate, so one defect
 * is not counted twice — under 2.2.0 a duplicate id is reported by both.
 */
export async function errorsIn(xml: string): Promise<{ parsed: boolean; errors: Diagnostic[] }> {
  const core = await loadCore();
  const parsed = core.parse(xml);
  if (!parsed.ok) {
    return { parsed: false, errors: [parsed.error] };
  }

  const { validate } = await loadValidate();
  const validation = validate(xml);
  const integrity = validation.valid ? core.checkIntegrity(xml) : [];
  const errors = [...validation.diagnostics, ...integrity].filter((d) => d.severity === 'error');
  return { parsed: true, errors };
}

/**
 * A stable identity for a diagnostic.
 *
 * Deliberately excludes the line: an edit above a pre-existing error shifts its
 * line without changing the error, and counting that as "introduced" would
 * refuse a perfectly good write.
 */
function signature(d: Diagnostic): string {
  return `${d.rule ?? ''}|${d.message}`;
}

/**
 * Compare a proposed document against what is on disk.
 *
 * `currentXml` is undefined when the file does not exist yet, in which case any
 * parseable document is an improvement on nothing.
 */
export async function evaluateSpecWrite(
  currentXml: string | undefined,
  nextXml: string
): Promise<WriteDecision> {
  const next = await errorsIn(nextXml);
  if (!next.parsed) {
    return { allow: false, kind: 'unparseable', introduced: next.errors };
  }

  if (!currentXml) {
    return { allow: true, remaining: next.errors };
  }

  const current = await errorsIn(currentXml);
  const before = new Set(current.errors.map(signature));
  const introduced = next.errors.filter((d) => !before.has(signature(d)));

  if (introduced.length > 0) {
    return { allow: false, kind: 'introduces-errors', introduced };
  }
  return { allow: true, remaining: next.errors };
}

/** The message shown to the agent when a write is refused. */
export function refusalMessage(decision: Extract<WriteDecision, { allow: false }>): string {
  if (decision.kind === 'unparseable') {
    const message = decision.introduced[0]?.message ?? 'the document is not well-formed XML';
    return (
      `Refused to write the specification: the content does not parse — ${message}. ` +
      `Nothing was written, and the file on disk is unchanged. ` +
      `An unparseable specification cannot be repaired by any other tool here, ` +
      `so this is refused even when a write would otherwise be allowed.`
    );
  }

  const list = decision.introduced
    .slice(0, 5)
    .map((d) => `  • ${d.message}`)
    .join('\n');
  const more =
    decision.introduced.length > 5 ? `\n  …and ${decision.introduced.length - 5} more.` : '';
  return (
    `Refused to write the specification: the content introduces ` +
    `${decision.introduced.length} error(s) the current document does not have.\n${list}${more}\n` +
    `Nothing was written, and the file on disk is unchanged. ` +
    `Fix the content and try again, or make a smaller, targeted change.`
  );
}
