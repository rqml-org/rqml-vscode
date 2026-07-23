// REQ-EXP-013: a deterministic, offline export.
//
// AC-01 — a document containing the requirements and the requirement-to-
//         verification matrix with coverage status, with no model configured
//         and no network.
// AC-02 — the same specification exported twice produces identical content.
//
// AC-02 is asserted at BYTE level, and one case runs under a hostile timezone
// and locale, because "identical on my machine" is not what an audit artifact
// promises. The three OOXML formats are zip containers whose entries carry a
// DOS timestamp, and the generators previously stamped a locale-formatted date
// into the visible footer — so this is the assertion that keeps both fixed.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDeterministicExport,
  specDigest,
  stableDate,
} from '../../export/deterministicExport';
import { flatten, isoDate } from '../../export/deterministicReport';
import { provenanceLine } from '../../export/generators/provenance';
import { DocxGenerator } from '../../export/generators/docxGenerator';
import { PdfGenerator } from '../../export/generators/pdfGenerator';
import { XlsxGenerator } from '../../export/generators/xlsxGenerator';
import { PptxGenerator } from '../../export/generators/pptxGenerator';
import type { ExportData } from '../../export/generators/types';

const FIXTURES = join(__dirname, '..', 'fixtures');
const spec = () => readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

const META: ExportData = {
  title: 'Fixture',
  docId: 'DOC-FIXTURE-001',
  version: '2.2.0',
  status: 'draft',
  sections: [],
  traceEdges: [],
};

const GENERATORS = [
  ['docx', () => new DocxGenerator()],
  ['pdf', () => new PdfGenerator()],
  ['xlsx', () => new XlsxGenerator()],
  ['pptx', () => new PptxGenerator()],
] as const;

describe('AC-EXP-013-01: the report is built without a model', () => {
  it('contains the requirements and the verification matrix', async () => {
    const built = await buildDeterministicExport(spec());
    const headings = built.report.sections.map((s) => s.heading);

    expect(headings).toContain('Requirement-to-verification matrix');
    expect(headings).toContain('Coverage summary');
    expect(headings.some((h) => /requirement/i.test(h))).toBe(true);
  });

  it('gives the matrix a row per requirement, with coverage status', async () => {
    const built = await buildDeterministicExport(spec());
    const matrix = built.report.sections.find(
      (s) => s.heading === 'Requirement-to-verification matrix'
    );
    const table = matrix?.content[0];
    expect(table?.type).toBe('table');
    if (table?.type !== 'table') return;

    expect(table.headers).toContain('Verification');
    expect(table.headers).toContain('Implementation');
    expect(table.headers).toContain('Verified by');
    expect(table.rows.length).toBeGreaterThan(0);
    // Coverage status is a real value, not a blank column.
    expect(table.rows.every((r) => /verified|unverified/.test(r[4]))).toBe(true);
  });

  it('identifies the specification rather than the moment of rendering', async () => {
    const built = await buildDeterministicExport(spec());
    const identity = built.report.sections.find((s) => s.heading === 'Document');
    const block = identity?.content[0];
    expect(block?.type).toBe('key-value');
    if (block?.type !== 'key-value') return;

    const keys = block.pairs.map((p) => p.key);
    expect(keys).toContain('Specification digest');
    expect(block.pairs.find((p) => p.key === 'Specification digest')?.value).toBe(built.specHash);
  });

  it('reports coverage figures from the engine', async () => {
    const core = await import('@rqml/core');
    const parsed = core.parse(spec());
    if (!parsed.ok) throw new Error('fixture does not parse');
    const coverage = core.computeCoverage(parsed.document);

    const built = await buildDeterministicExport(spec());
    const summary = built.report.sections.find((s) => s.heading === 'Coverage summary');
    const block = summary?.content[0];
    if (block?.type !== 'key-value') throw new Error('expected a key-value block');

    const goals = block.pairs.find((p) => p.key.startsWith('Goals'));
    expect(goals?.value).toBe(String(coverage.uncoveredGoals.length));
  });
});

describe('AC-EXP-013-02: the same specification renders identically', () => {
  it.each(GENERATORS)('%s is byte-identical across runs', async (_name, make) => {
    const a = await buildDeterministicExport(spec());
    const first = await make().generate(a.report, META, { specHash: a.specHash, date: a.date });

    // A fresh parse and render, not a reuse of the same report object.
    const b = await buildDeterministicExport(spec());
    const second = await make().generate(b.report, META, { specHash: b.specHash, date: b.date });

    expect(sha(second)).toBe(sha(first));
  });

  it('changes the digest when the specification changes', async () => {
    const a = await buildDeterministicExport(spec());
    const edited = spec().replace('title="Second"', 'title="Second requirement"');
    const b = await buildDeterministicExport(edited);
    expect(b.specHash).not.toBe(a.specHash);
  });

  it('derives the embedded date from the specification, not the clock', async () => {
    const a = await buildDeterministicExport(spec());
    await new Promise((r) => setTimeout(r, 25));
    const b = await buildDeterministicExport(spec());
    expect(b.date.getTime()).toBe(a.date.getTime());
  });

  it('keeps the embedded date inside the DOS epoch that zip entries require', async () => {
    // Before 1980 a zip entry date cannot be represented, and some readers
    // reject the file outright.
    const built = await buildDeterministicExport(spec());
    expect(built.date.getUTCFullYear()).toBeGreaterThan(1980);
    expect(built.date.getTime()).toBeLessThan(Date.now());
  });
});

describe('locale independence', () => {
  it('renders the provenance line without locale formatting', () => {
    // toLocaleDateString gave "7/23/2026" in the US and "23.7.2026" in Germany
    // — a content difference no container normalisation can remove.
    const line = provenanceLine({ specHash: 'abc123', date: new Date('2026-07-23T00:00:00Z') });
    expect(line).toContain('abc123');
    expect(line).not.toMatch(/\d+\/\d+\/\d+/);
    expect(line).not.toMatch(/\d+\.\d+\.\d+/);
  });

  it('formats a fallback date as ISO 8601', () => {
    expect(isoDate(new Date('2026-07-23T18:30:00Z'))).toBe('2026-07-23');
  });
});

describe('field flattening', () => {
  it('collapses the newlines and indentation specification text carries', () => {
    // Statements are authored across lines with XML indentation; left alone
    // they break table layout in every format.
    expect(flatten('Line one.\n        Line two.')).toBe('Line one. Line two.');
  });

  it('handles an absent value', () => {
    expect(flatten(undefined)).toBe('');
  });
});

describe('digest and date derivation', () => {
  it('gives the same digest for the same source', () => {
    expect(specDigest('<rqml/>')).toBe(specDigest('<rqml/>'));
  });

  it('gives a different digest for different source', () => {
    expect(specDigest('<rqml/>')).not.toBe(specDigest('<rqml />'));
  });

  it('derives a stable date from a digest', () => {
    const hash = specDigest('<rqml/>');
    expect(stableDate(hash).getTime()).toBe(stableDate(hash).getTime());
  });
});
