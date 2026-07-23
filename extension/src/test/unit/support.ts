// Shared helpers for the unit tests. Not a test file — vitest collects only
// *.test.ts, so this is never run as a suite.

import type { RqmlDocument } from '../../services/core';

interface ParseLike {
  parse(xml: string): { ok: true; document: RqmlDocument } | { ok: false; error: { message: string } };
}

/**
 * Parse a fixture, failing loudly if it does not parse.
 *
 * `parse` returns a discriminated union, so reaching for `.document` without
 * narrowing is a type error — and a fixture that has stopped parsing should
 * fail the test that uses it with a clear message, rather than producing
 * `undefined` and a confusing assertion failure further down.
 */
export function parseOrThrow(core: ParseLike, xml: string): RqmlDocument {
  const result = core.parse(xml);
  if (!result.ok) {
    throw new Error(`fixture failed to parse: ${result.error.message}`);
  }
  return result.document;
}
