// Under 2.1.0 the schema's xs:unique selectors were inert, so a duplicate id
// was reported once, by checkIntegrity. Under 2.2.0 they fire, so the same
// defect arrives twice in different wording and the Problems panel reads as
// though there were two problems.
//
// The risk in fixing that is over-filtering: a de-duplication that is too eager
// discards real diagnostics, and a dropped diagnostic is invisible. These tests
// pin both directions.

import { describe, expect, it } from 'vitest';
import { mergeDiagnostics } from '../../services/diagnosticsMerge';
import type { Diagnostic } from '../../services/core';

const diag = (message: string, extra: Partial<Diagnostic> = {}): Diagnostic =>
  ({ severity: 'error', message, line: 42, ...extra }) as Diagnostic;

const XSD_DUPLICATE = diag(
  "Element '{https://rqml.org/schema/2.2.0}req': Duplicate key-sequence ['REQ-A'] in unique identity-constraint 'declaredIds'."
);
const INTEGRITY_DUPLICATE = diag(
  'Duplicate id "REQ-A": this id is already declared elsewhere in the document.'
);

describe('mergeDiagnostics', () => {
  it('collapses the two reports of one duplicate id, keeping the readable one', () => {
    const merged = mergeDiagnostics([XSD_DUPLICATE], [INTEGRITY_DUPLICATE]);
    expect(merged).toEqual([INTEGRITY_DUPLICATE]);
  });

  it('keeps the schema report when no integrity diagnostic corroborates it', () => {
    // Nothing else knows about this defect, so dropping it would lose it.
    expect(mergeDiagnostics([XSD_DUPLICATE], [])).toEqual([XSD_DUPLICATE]);
  });

  it('collapses only the id that is actually duplicated twice', () => {
    const otherId = diag("Duplicate key-sequence ['REQ-B'] in unique identity-constraint.");
    const merged = mergeDiagnostics([XSD_DUPLICATE, otherId], [INTEGRITY_DUPLICATE]);
    expect(merged).toContain(otherId);
    expect(merged).not.toContain(XSD_DUPLICATE);
  });

  it('never drops a dangling trace reference', () => {
    // Integrity-only: the schema has no keyref for endpoints.
    const dangling = diag('Trace edge "E-1" (to) references unknown id "REQ-NOPE".');
    expect(mergeDiagnostics([], [dangling])).toEqual([dangling]);
  });

  it('never drops a facet violation', () => {
    // XSD-only: checkIntegrity does not evaluate enumerations.
    const enumViolation = diag("attribute 'status': [facet 'enumeration'] The value 'bogus' is not an element of the set.");
    expect(mergeDiagnostics([enumViolation], [INTEGRITY_DUPLICATE])).toContain(enumViolation);
  });

  it('passes both sets through untouched when there is no duplicate id at all', () => {
    const a = diag('one');
    const b = diag('two');
    expect(mergeDiagnostics([a], [b])).toEqual([a, b]);
  });

  it('degrades to showing both if the upstream phrasing changes', () => {
    // Deliberate: an unrecognised message must survive. Showing a duplicate is
    // visible and fixable; silently discarding a diagnostic is neither.
    const reworded = diag('Element req: key REQ-A appears more than once.');
    expect(mergeDiagnostics([reworded], [INTEGRITY_DUPLICATE])).toHaveLength(2);
  });
});
