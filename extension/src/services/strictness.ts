// REQ-AGT-013, REQ-AGT-014: one answer to "how strict is this project".
//
// Strictness was resolved in two places that could disagree. The agent read the
// setting and then AGENTS.md; the gate read only the setting. That is not a
// cosmetic split — strictness decides whether coverage findings fail the gate
// (gate/verdict.ts `coverageBlocks`), so a project declaring `strict` in
// AGENTS.md with no VS Code setting got a strict agent and a standard gate.
//
// The parsing here imports no vscode API so it can be unit-tested directly.

/** The four levels, in the vocabulary AGENTS.md and the settings both use. */
export const STRICTNESS_LEVELS = ['relaxed', 'standard', 'strict', 'certified'] as const;
export type StrictnessLevel = (typeof STRICTNESS_LEVELS)[number];

export const DEFAULT_STRICTNESS: StrictnessLevel = 'standard';

/**
 * Read the level from an AGENTS.md.
 *
 * The declaration is a heading — ``## Strictness: `standard` `` — so the match
 * is anchored to a heading at the start of a line and the level must be one of
 * the four legal words on the same line.
 *
 * The looser pattern this replaces (``/Strictness:\s*`(\w+)`/i``) happens to
 * give the right answer on every AGENTS.md in the portfolio today, so this is
 * hardening rather than a bug fix. It matters because `\s*` crosses newlines
 * and the pattern is unanchored: `## Strictness:` followed by prose beginning
 * with a backticked word resolves to that word, and a sentence mentioning
 * ``Strictness: `certified` `` anywhere above the real heading wins over it.
 * Both are plausible edits to a document people hand-write.
 */
export function parseStrictness(agentsMd: string): StrictnessLevel | undefined {
  const heading = /^[ \t]*#{1,6}[ \t]*Strictness[ \t]*:[ \t]*`?(relaxed|standard|strict|certified)`?[ \t]*$/im;
  const match = heading.exec(agentsMd);
  if (match) {return match[1].toLowerCase() as StrictnessLevel;}
  return undefined;
}

/** Narrow an arbitrary string to a level. */
export function isStrictnessLevel(value: string | undefined): value is StrictnessLevel {
  return !!value && (STRICTNESS_LEVELS as readonly string[]).includes(value);
}
