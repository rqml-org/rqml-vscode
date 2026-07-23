// REQ-AGT-013, REQ-AGT-014.
//
// Strictness decides whether coverage findings fail the gate, so mis-reading
// AGENTS.md silently changes what passes. These pin the parse against the real
// portfolio template and against the edits most likely to break a loose regex.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseStrictness,
  isStrictnessLevel,
  DEFAULT_STRICTNESS,
  STRICTNESS_LEVELS,
} from '../../services/strictness';

const REPO_AGENTS_MD = join(__dirname, '..', '..', '..', '..', 'AGENTS.md');

describe('parseStrictness', () => {
  it('reads the level from this repository’s real AGENTS.md', () => {
    expect(parseStrictness(readFileSync(REPO_AGENTS_MD, 'utf8'))).toBe('standard');
  });

  it('is not fooled by the Strictness Reference table below the declaration', () => {
    // The shared template carries a table naming every level. Reading it would
    // resolve an arbitrary level from a row rather than the declaration.
    const md = readFileSync(REPO_AGENTS_MD, 'utf8');
    expect(md).toContain('## Strictness Reference');
    expect(md).toContain('certified');
    expect(parseStrictness(md)).toBe('standard');
  });

  it('reads the Reference section alone as declaring nothing', () => {
    const md = readFileSync(REPO_AGENTS_MD, 'utf8');
    const referenceOnly = md.slice(md.indexOf('## Strictness Reference'));
    expect(parseStrictness(referenceOnly)).toBeUndefined();
  });

  it.each(STRICTNESS_LEVELS)('accepts %s as a declared level', (level) => {
    expect(parseStrictness(`## Strictness: \`${level}\`\n`)).toBe(level);
  });

  it('accepts the declaration without backticks', () => {
    expect(parseStrictness('## Strictness: strict\n')).toBe('strict');
  });

  it('is case-insensitive', () => {
    expect(parseStrictness('## STRICTNESS: `STRICT`\n')).toBe('strict');
  });

  it('does not read a level out of surrounding prose', () => {
    // The looser pattern this replaced matched across a newline and would take
    // the first backticked word of the following paragraph.
    const md = '## Strictness:\n\n`certified` is the highest level available.\n';
    expect(parseStrictness(md)).toBeUndefined();
  });

  it('does not let a sentence outrank the heading', () => {
    const md = 'Use Strictness: `certified` only for SaMD work.\n\n## Strictness: `standard`\n';
    expect(parseStrictness(md)).toBe('standard');
  });

  it('rejects a word that is not one of the four levels', () => {
    expect(parseStrictness('## Strictness: `paranoid`\n')).toBeUndefined();
  });

  it('returns undefined for a file with no declaration', () => {
    expect(parseStrictness('# Some other document\n\nNothing here.\n')).toBeUndefined();
  });
});

describe('isStrictnessLevel', () => {
  it('accepts the four levels and nothing else', () => {
    for (const level of STRICTNESS_LEVELS) expect(isStrictnessLevel(level)).toBe(true);
    expect(isStrictnessLevel('')).toBe(false);
    expect(isStrictnessLevel(undefined)).toBe(false);
    expect(isStrictnessLevel('lenient')).toBe(false); // @rqml/core's lint vocabulary, not this one
  });

  it('defaults to standard', () => {
    expect(DEFAULT_STRICTNESS).toBe('standard');
  });
});
