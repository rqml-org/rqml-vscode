// REQ-UI-013B: reconciling XSD and referential-integrity diagnostics.
//
// Kept free of any `vscode` import so it can be unit-tested in plain Node
// without an extension host.

import type { Diagnostic } from './core';

/** libxml2's report of an `xs:unique` violation, e.g. Duplicate key-sequence ['REQ-A']. */
const XSD_DUPLICATE_KEY = /duplicate key-sequence\s*\[\s*'([^']+)'\s*\]/i;
/** checkIntegrity's report of the same defect, e.g. Duplicate id "REQ-A". */
const INTEGRITY_DUPLICATE_ID = /duplicate id\s+"([^"]+)"/i;

/**
 * Merge XSD and referential-integrity diagnostics, dropping the schema's
 * duplicate-key report when checkIntegrity already reports that same id.
 *
 * Why this is needed at all: the 2.1.0 schema's `xs:unique` selectors used
 * unprefixed names against a namespaced, qualified schema, so libxml2 matched
 * nothing and the identity constraints were inert — checkIntegrity() was the
 * only thing reporting a duplicate id. In 2.2.0 the selectors are
 * namespace-qualified and fire correctly, so one defect is now reported twice:
 * once in libxml2's phrasing and once in a readable one. Both are correct, but
 * showing both makes the Problems panel read as though there were two problems.
 * The readable one wins.
 *
 * The match is deliberately narrow — the same id must appear in both, and an
 * integrity diagnostic must actually be present. If the upstream phrasing
 * changes, this degrades to showing the duplicate again, which is visible,
 * rather than silently discarding a diagnostic, which is not.
 */
export function mergeDiagnostics(
  xsd: readonly Diagnostic[],
  integrity: readonly Diagnostic[]
): Diagnostic[] {
  const duplicateIds = new Set<string>();
  for (const d of integrity) {
    const m = INTEGRITY_DUPLICATE_ID.exec(d.message ?? '');
    if (m) duplicateIds.add(m[1]);
  }

  if (duplicateIds.size === 0) return [...xsd, ...integrity];

  const filtered = xsd.filter((d) => {
    const m = XSD_DUPLICATE_KEY.exec(d.message ?? '');
    return !(m && duplicateIds.has(m[1]));
  });

  return [...filtered, ...integrity];
}
