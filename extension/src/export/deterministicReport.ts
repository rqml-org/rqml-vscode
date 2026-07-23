// REQ-EXP-013: build a report from @rqml/core alone — no language model, no
// network, no clock.
//
// The four format generators take a `GeneratedReport`, which until now only a
// model could produce. Nothing about that shape requires a model: it is
// headings and content blocks. Building it from the engine's typed
// intermediates gives every format a deterministic path while reusing all the
// existing layout code unchanged.
//
// Built from `DocumentOutline` and `MatrixReport` rather than from core's
// markdown renderers, deliberately. The markdown is a lossy middle layer —
// `outlineToMarkdown` escapes cell values only inside trace tables, so a
// statement containing a newline or a pipe corrupts the surrounding document.
// Going from typed data straight to structured blocks avoids that entirely.
//
// Kept free of any `vscode` import so the whole report can be unit-tested.

import type {
  CoverageReport,
  DocumentOutline,
  MatrixReport,
  MatrixRow,
  OutlineNode,
} from '../services/core';
import type { GeneratedContent, GeneratedReport, GeneratedSection } from './schemas/reportOutput';

/**
 * Flatten a value for a table cell or a field.
 *
 * Specification text is authored across multiple lines with XML indentation, so
 * it arrives with hard newlines and runs of whitespace. Left alone those break
 * table layout in every format; collapsing them is what makes a cell a cell.
 */
export function flatten(value: string | undefined): string {
  if (!value) {return '';}
  return value.replace(/\s+/g, ' ').trim();
}

/** ISO 8601, so the same document reads identically in every locale. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function walk(nodes: readonly OutlineNode[], visit: (node: OutlineNode, depth: number) => void, depth = 0): void {
  for (const node of nodes) {
    visit(node, depth);
    if (node.children?.length) {walk(node.children, visit, depth + 1);}
  }
}

/** The document-identity block every exported artifact opens with. */
function identitySection(outline: DocumentOutline, specHash: string): GeneratedSection {
  const pairs = [
    { key: 'Document', value: outline.docId },
    { key: 'Schema version', value: outline.version },
    { key: 'Status', value: outline.status },
  ];
  if (outline.system) {pairs.push({ key: 'System', value: flatten(outline.system) });}
  // The identity of the source, not the time of rendering: re-exporting an
  // unchanged specification must produce an identical document.
  pairs.push({ key: 'Specification digest', value: specHash });

  return {
    heading: 'Document',
    layoutHint: 'summary',
    content: [{ type: 'key-value', pairs }],
  };
}

/** Coverage totals, in the engine's own terms. */
function summarySection(matrix: MatrixReport, coverage: CoverageReport): GeneratedSection {
  const s = matrix.summary;
  return {
    heading: 'Coverage summary',
    layoutHint: 'summary',
    content: [
      {
        type: 'key-value',
        pairs: [
          { key: 'Requirements', value: String(s.total) },
          { key: 'Verified', value: `${s.verified} of ${s.total}` },
          { key: 'Implemented', value: `${s.implemented} of ${s.total}` },
          { key: 'Premature implementations', value: String(s.premature) },
          { key: 'Orphans (satisfy no goal or scenario)', value: String(s.orphans) },
          { key: 'Broken trace references', value: String(s.brokenTraces) },
          { key: 'Goals with no satisfying requirement', value: String(coverage.uncoveredGoals.length) },
        ],
      },
    ],
  };
}

/**
 * The requirement-to-verification matrix REQ-EXP-013 names.
 *
 * `MatrixRow.tests` carries outgoing `verifiedBy` edges. A requirement verified
 * by an INCOMING `covers` edge from a test case is reported as verified with an
 * empty tests list, which in an audit document reads as an unsupported claim.
 * `coversByRequirement` supplies those, so the evidence column is never empty
 * for a row marked verified.
 */
function matrixSection(
  matrix: MatrixReport,
  coversByRequirement: ReadonlyMap<string, readonly string[]>
): GeneratedSection {
  // A MatrixRef is an object, not a string: `id` plus an optional title and
  // flags marking external or broken references. A broken one is marked so an
  // auditor is not shown a reference that resolves to nothing.
  const refs = (list: readonly { id: string; broken?: boolean }[]): string[] =>
    list.map((r) => (r.broken ? `${r.id} (unresolved)` : r.id));

  const rows = matrix.rows.map((row: MatrixRow) => {
    const tests = refs(row.tests);
    const covers = coversByRequirement.get(row.id) ?? [];
    const evidence = [...tests, ...covers.filter((c) => !tests.includes(c))];
    return [
      row.id,
      flatten(row.title),
      row.type,
      row.status,
      row.verification,
      row.implementation,
      refs(row.goals).join(', '),
      refs(row.implementations).join(', '),
      evidence.join(', '),
    ];
  });

  return {
    heading: 'Requirement-to-verification matrix',
    layoutHint: 'table',
    content: [
      {
        type: 'table',
        headers: [
          'ID',
          'Title',
          'Type',
          'Status',
          'Verification',
          'Implementation',
          'Satisfies',
          'Implemented by',
          'Verified by',
        ],
        rows,
      },
    ],
  };
}

/** One section per requirement package, with statements and acceptance criteria. */
function requirementSections(outline: DocumentOutline): GeneratedSection[] {
  const sections: GeneratedSection[] = [];

  for (const section of outline.sections) {
    const blocks: GeneratedContent[] = [];

    walk(section.children ?? [], (node, depth) => {
      const heading = node.id ? `${node.id} — ${flatten(node.title)}` : flatten(node.title);
      if (!heading) {return;}

      // A package or grouping renders as a lead-in; a leaf renders its fields.
      if (depth === 0 && node.children?.length) {
        blocks.push({ type: 'paragraph', text: heading });
        return;
      }

      const pairs = (node.fields ?? [])
        .map((f) => ({ key: flatten(f.label), value: flatten(String(f.value ?? '')) }))
        .filter((p) => p.key && p.value);

      if (pairs.length === 0) {
        blocks.push({ type: 'paragraph', text: heading });
        return;
      }

      blocks.push({ type: 'paragraph', text: heading });
      blocks.push({ type: 'key-value', pairs });
    });

    if (blocks.length > 0) {
      sections.push({ heading: flatten(section.title), layoutHint: 'content', content: blocks });
    }
  }

  return sections;
}

export interface DeterministicReportInput {
  outline: DocumentOutline;
  matrix: MatrixReport;
  coverage: CoverageReport;
  /** Test-case ids covering each requirement, from incoming `covers` edges. */
  coversByRequirement: ReadonlyMap<string, readonly string[]>;
  /** A digest of the specification source — the document's identity. */
  specHash: string;
  /** Report title; defaults to the document's own title. */
  title?: string;
}

/**
 * Assemble a report containing the requirements and the
 * requirement-to-verification matrix with coverage status (AC-EXP-013-01).
 *
 * Every value is derived from the arguments; nothing reads the clock, the
 * locale or the network, so the same specification yields the same report
 * (AC-EXP-013-02).
 */
export function buildDeterministicReport(input: DeterministicReportInput): GeneratedReport {
  const { outline, matrix, coverage, coversByRequirement, specHash } = input;

  return {
    title: input.title ?? flatten(outline.title) ?? outline.docId,
    subtitle: `Specification ${outline.docId} · schema ${outline.version} · ${outline.status}`,
    sections: [
      identitySection(outline, specHash),
      summarySection(matrix, coverage),
      matrixSection(matrix, coversByRequirement),
      ...requirementSections(outline),
    ],
  };
}
