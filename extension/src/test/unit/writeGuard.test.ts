// The specification used to be writable with raw model output and no checks at
// all: `content: z.string()` accepts an empty string, prose, or a document
// truncated mid-element, and the write reached neither the undo stack nor a
// backup. These are the payloads that would have destroyed it.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateSpecWrite, errorsIn, refusalMessage } from '../../services/spec/writeGuard';

const FIXTURES = join(__dirname, '..', 'fixtures');
const GOOD = readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8');

const refused = (d: Awaited<ReturnType<typeof evaluateSpecWrite>>) => {
  if (d.allow) throw new Error('expected the write to be refused');
  return d;
};

describe('evaluateSpecWrite — payloads that would have destroyed the spec', () => {
  it('refuses an empty document', async () => {
    expect(refused(await evaluateSpecWrite(GOOD, '')).kind).toBe('unparseable');
  });

  it('refuses prose', async () => {
    const d = refused(await evaluateSpecWrite(GOOD, 'Sure! Here is the updated specification:'));
    expect(d.kind).toBe('unparseable');
  });

  it('refuses a document truncated mid-element', async () => {
    const d = refused(await evaluateSpecWrite(GOOD, GOOD.slice(0, Math.floor(GOOD.length * 0.4))));
    expect(d.kind).toBe('unparseable');
  });

  it('refuses a fenced code block, which a model readily emits', async () => {
    const d = refused(await evaluateSpecWrite(GOOD, '```xml\n' + GOOD + '\n```'));
    expect(d.kind).toBe('unparseable');
  });

  it('refuses well-formed XML that is not RQML', async () => {
    const d = refused(await evaluateSpecWrite(GOOD, '<hello><world/></hello>'));
    // Parses as XML, so this is caught by validation rather than the parser.
    expect(d.introduced.length).toBeGreaterThan(0);
  });
});

describe('evaluateSpecWrite — semantic damage that still parses', () => {
  it('refuses a dangling trace reference', async () => {
    const broken = GOOD.replace('to="GOAL-ONE"', 'to="GOAL-DOES-NOT-EXIST"');
    const d = refused(await evaluateSpecWrite(GOOD, broken));
    expect(d.kind).toBe('introduces-errors');
    expect(d.introduced.some((x) => /unknown id/i.test(x.message))).toBe(true);
  });

  it('refuses a duplicate id', async () => {
    const broken = GOOD.replace('id="REQ-F-002"', 'id="REQ-F-001"');
    expect(refused(await evaluateSpecWrite(GOOD, broken)).kind).toBe('introduces-errors');
  });

  it('refuses an invalid enumeration value', async () => {
    const broken = GOOD.replace('status="approved"', 'status="ratified"');
    expect(refused(await evaluateSpecWrite(GOOD, broken)).kind).toBe('introduces-errors');
  });
});

describe('evaluateSpecWrite — writes that must be allowed', () => {
  it('allows an unchanged document', async () => {
    const d = await evaluateSpecWrite(GOOD, GOOD);
    expect(d.allow).toBe(true);
  });

  it('allows a legitimate edit', async () => {
    const edited = GOOD.replace('title="Second"', 'title="Second requirement"');
    expect((await evaluateSpecWrite(GOOD, edited)).allow).toBe(true);
  });

  it('allows any parseable document when there is no file yet', async () => {
    expect((await evaluateSpecWrite(undefined, GOOD)).allow).toBe(true);
  });

  it('allows a write that REPAIRS an already-broken document', async () => {
    // The decisive case for "no worse than before" over "must be perfect":
    // requiring a clean result would block the edit that fixes the damage.
    const broken = GOOD.replace('to="GOAL-ONE"', 'to="GOAL-MISSING"');
    expect((await evaluateSpecWrite(broken, GOOD)).allow).toBe(true);
  });

  it('allows an unrelated edit to an already-broken document', async () => {
    const broken = GOOD.replace('to="GOAL-ONE"', 'to="GOAL-MISSING"');
    const brokenAndEdited = broken.replace('title="Second"', 'title="Second requirement"');
    const d = await evaluateSpecWrite(broken, brokenAndEdited);
    expect(d.allow).toBe(true);
    // The pre-existing error is reported rather than silently accepted.
    if (d.allow) expect(d.remaining.length).toBeGreaterThan(0);
  });

  it('does not treat a line shift as a new error', async () => {
    // Diagnostics are identified by rule and message, not line: inserting a
    // comment above a pre-existing error moves it without changing it.
    const broken = GOOD.replace('to="GOAL-ONE"', 'to="GOAL-MISSING"');
    const shifted = broken.replace('<meta>', '<!-- a note -->\n  <meta>');
    expect((await evaluateSpecWrite(broken, shifted)).allow).toBe(true);
  });
});

describe('refusalMessage', () => {
  it('says nothing was written', async () => {
    const d = refused(await evaluateSpecWrite(GOOD, ''));
    expect(refusalMessage(d)).toMatch(/nothing was written/i);
    expect(refusalMessage(d)).toMatch(/unchanged/i);
  });

  it('names the errors it refused over', async () => {
    const broken = GOOD.replace('to="GOAL-ONE"', 'to="GOAL-DOES-NOT-EXIST"');
    const message = refusalMessage(refused(await evaluateSpecWrite(GOOD, broken)));
    expect(message).toContain('GOAL-DOES-NOT-EXIST');
  });

  it('caps the list so a hundred errors do not flood the conversation', async () => {
    const d = refused(await evaluateSpecWrite(GOOD, '<hello><world/></hello>'));
    const bullets = (refusalMessage(d).match(/^ {2}•/gm) ?? []).length;
    expect(bullets).toBeLessThanOrEqual(5);
  });
});

describe('errorsIn', () => {
  it('reports a clean document as clean', async () => {
    const result = await errorsIn(GOOD);
    expect(result.parsed).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('counts a duplicate id once, not twice', async () => {
    // Under 2.2.0 the schema's xs:unique and checkIntegrity both see it; the
    // gate runs integrity only when validation passed, and so does this.
    const dup = GOOD.replace('id="REQ-F-002"', 'id="REQ-F-001"');
    const result = await errorsIn(dup);
    expect(result.errors.filter((d) => /duplicate/i.test(d.message))).toHaveLength(1);
  });
});
