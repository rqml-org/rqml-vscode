// Text edits to the specification, tested hard because editing XML as text is
// fragile — and because the alternative is worse: parse → serialize preserves
// the model but reflows the file and deletes every XML comment, which would
// silently strip a user's commentary on a rename.
//
// Nothing here reaches disk unchecked; every caller writes through
// writeSpecGuarded. These tests cover the edits themselves.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deleteElement,
  findElementRange,
  findOpeningTag,
  insertIntoSection,
  renameElement,
} from '../../services/spec/textEdit';
import { evaluateSpecWrite } from '../../services/spec/writeGuard';
import { parseOrThrow } from './support';

const FIXTURES = join(__dirname, '..', 'fixtures');
const spec = () => readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8');

const ok = (r: ReturnType<typeof renameElement>) => {
  if (!r.ok) throw new Error(`expected success, got: ${r.error}`);
  return r.xml;
};

describe('findOpeningTag', () => {
  it('finds an element by its id and reports its name', () => {
    const tag = findOpeningTag(spec(), 'REQ-F-001');
    expect(tag?.name).toBe('req');
  });

  it('does not match an id that is merely a prefix of another', () => {
    const xml = '<req id="REQ-A-1"/><req id="REQ-A-10" title="ten"/>';
    const tag = findOpeningTag(xml, 'REQ-A-1');
    expect(xml.slice(tag!.start, tag!.end)).toBe('<req id="REQ-A-1"/>');
  });

  it('reports a self-closing tag as such', () => {
    expect(findOpeningTag('<edge id="E-1" type="satisfies" from="A" to="B"/>', 'E-1')?.selfClosing)
      .toBe(true);
  });

  it('returns nothing for an unknown id', () => {
    expect(findOpeningTag(spec(), 'REQ-NOPE')).toBeUndefined();
  });
});

describe('findElementRange', () => {
  it('spans the whole element including its children', () => {
    const xml = spec();
    const range = findElementRange(xml, 'REQ-F-001');
    const text = xml.slice(range!.start, range!.end);
    expect(text.startsWith('<req')).toBe(true);
    expect(text.endsWith('</req>')).toBe(true);
    expect(text).toContain('<statement>');
  });

  it('does not stop at a nested element of the same name', () => {
    // The case a lazy match gets wrong: a <req> inside a <reqPackage> means the
    // first </reqPackage> encountered is not the container's.
    const xml =
      '<reqPackage id="PKG-A"><req id="R-1"><statement>x</statement></req></reqPackage>';
    const range = findElementRange(xml, 'PKG-A');
    expect(xml.slice(range!.start, range!.end)).toBe(xml);
  });

  it('handles a self-closing element', () => {
    const xml = '<trace><edge id="E-1" type="satisfies" from="A" to="B"/></trace>';
    const range = findElementRange(xml, 'E-1');
    expect(xml.slice(range!.start, range!.end)).toBe('<edge id="E-1" type="satisfies" from="A" to="B"/>');
  });

  it('refuses to guess when tags are unbalanced', () => {
    expect(findElementRange('<req id="R-1"><statement>x</statement>', 'R-1')).toBeUndefined();
  });
});

describe('renameElement', () => {
  it('changes only the title attribute', () => {
    const before = spec();
    const after = ok(renameElement(before, 'REQ-F-001', 'A better title'));
    expect(after).toContain('title="A better title"');
    expect(after.length).not.toBe(before.length);
    // Everything outside the one tag is untouched.
    expect(after.replace('A better title', 'First')).toBe(before);
  });

  it('preserves XML comments, which parse → serialize would delete', () => {
    const withComment = spec().replace('<meta>', '<!-- keep me -->\n  <meta>');
    expect(ok(renameElement(withComment, 'REQ-F-001', 'Renamed'))).toContain('<!-- keep me -->');
  });

  it('escapes characters that would break the attribute', () => {
    const after = ok(renameElement(spec(), 'REQ-F-001', 'A & B "quoted" <tag>'));
    expect(after).toContain('&amp;');
    expect(after).toContain('&quot;');
    expect(after).toContain('&lt;');
  });

  it('adds a title when the element has none', () => {
    const xml = '<trace><edge id="E-1" type="satisfies" from="A" to="B"/></trace>';
    expect(ok(renameElement(xml, 'E-1', 'New'))).toContain('id="E-1" title="New"');
  });

  it('reports an unknown id rather than editing something else', () => {
    const result = renameElement(spec(), 'REQ-NOPE', 'x');
    expect(result.ok).toBe(false);
  });

  it('leaves the document valid', async () => {
    const after = ok(renameElement(spec(), 'REQ-F-001', 'Renamed'));
    expect((await evaluateSpecWrite(spec(), after)).allow).toBe(true);
  });
});

describe('deleteElement', () => {
  it('removes the element declaration', () => {
    const after = ok(deleteElement(spec(), 'REQ-F-002'));
    expect(after).not.toContain('<req id="REQ-F-002"');
    expect(after).not.toContain('The system SHALL do the second thing.');
    expect(after).toContain('<req id="REQ-F-001"');
  });

  it('removes only the declaration, leaving references for the guard to catch', async () => {
    // Deliberate: deleting an element does not silently rewrite every edge that
    // points at it. The resulting dangling reference is a real problem the user
    // must resolve, and the write guard is what surfaces it.
    const after = ok(deleteElement(spec(), 'REQ-F-002'));
    expect(after).toContain('from="REQ-F-002"'); // E-DEP still refers to it
    expect((await evaluateSpecWrite(spec(), after)).allow).toBe(false);
  });

  it('leaves no ragged blank line behind', () => {
    expect(ok(deleteElement(spec(), 'REQ-F-002'))).not.toMatch(/\n[ \t]+\n[ \t]*<\/reqPackage>/);
  });

  it('reports an unknown id', () => {
    expect(deleteElement(spec(), 'REQ-NOPE').ok).toBe(false);
  });

  it('is caught by the write guard when it would dangle a reference', async () => {
    // REQ-F-001 is referenced by two trace edges. Deleting it is well-formed
    // but breaks integrity — the guard is what stops it reaching disk.
    const after = ok(deleteElement(spec(), 'REQ-F-001'));
    const decision = await evaluateSpecWrite(spec(), after);
    expect(decision.allow).toBe(false);
  });
});

describe('insertIntoSection', () => {
  it('inserts a skeleton requirement and leaves the document valid', async () => {
    const core = await import('@rqml/core');
    const snippet = core.skeleton('req', { id: 'REQ-F-003' });
    const after = ok(insertIntoSection(spec(), 'reqPackage', snippet));

    expect(after).toContain('REQ-F-003');
    const document = parseOrThrow(core, after);
    expect(document).toBeDefined();
    expect((await evaluateSpecWrite(spec(), after)).allow).toBe(true);
  });

  it('indents the snippet to match its surroundings', async () => {
    const core = await import('@rqml/core');
    const after = ok(insertIntoSection(spec(), 'reqPackage', core.skeleton('req', { id: 'REQ-F-003' })));
    expect(after).toMatch(/\n {6}<req id="REQ-F-003"/);
  });

  it('reports a missing section rather than inserting nowhere', () => {
    expect(insertIntoSection(spec(), 'nonexistent', '<x/>').ok).toBe(false);
  });

  it('is caught by the write guard when the snippet has placeholder references', async () => {
    // skeleton('edge') emits placeholder endpoints that resolve to nothing, so
    // it is schema-valid but not integrity-clean. The guard refuses it.
    const core = await import('@rqml/core');
    const after = ok(insertIntoSection(spec(), 'trace', core.skeleton('edge', { id: 'E-NEW' })));
    expect((await evaluateSpecWrite(spec(), after)).allow).toBe(false);
  });
});
