// The engine's rule identifiers and the extractors that read its messages.
//
// Kept free of any `vscode` import so the constants can be asserted against the
// rules the engine actually emits, in a unit test. A wrong literal here
// produces no error anywhere — the quick fix simply never appears, which looks
// exactly like "there is nothing to fix".

/**
 * Drift rules whose remedy is re-recording the baseline.
 *
 * `missing-implementation` is deliberately absent: when the artifact is gone
 * there is nothing to re-pin, and the remedy — restore the file, or repoint the
 * edge — is not a one-click decision.
 *
 * `context-changed-implementation` is included ahead of need. @rqml/core 0.8.0
 * does not emit it; the monorepo's unreleased work adds it as a weaker drift
 * class for a file that changed around an unchanged fragment. Listing it now
 * means the affordance appears the moment that ships rather than silently not.
 */
export const REPINNABLE_RULES = new Set([
  'changed-implementation',
  'context-changed-implementation',
]);

/** An implements edge pointing at a requirement that is not approved. */
export const PREMATURE_RULE = 'premature-implementation';

/** Drift rule for an artifact that no longer exists. */
export const MISSING_RULE = 'missing-implementation';

/**
 * The first quoted identifier in a message.
 *
 * The engine quotes its subject first: `implements edge "E-1" points at
 * "src/a.ts", which has changed since approval.`
 */
export function firstQuoted(message: string): string | undefined {
  return /"([A-Za-z][A-Za-z0-9._-]{1,79})"/.exec(message)?.[1];
}

/**
 * The requirement id in a premature-implementation message.
 *
 * The edge id is quoted first — `implements edge "E-1" targets requirement
 * "REQ-A", which is not approved.` — so taking the first quoted value would
 * approve the wrong thing, or nothing.
 */
export function requirementIn(message: string): string | undefined {
  for (const match of message.matchAll(/"([A-Za-z][A-Za-z0-9._-]{1,79})"/g)) {
    if (match[1].startsWith('REQ-')) return match[1];
  }
  return /\b(REQ-[A-Za-z0-9._-]+)\b/.exec(message)?.[1];
}
