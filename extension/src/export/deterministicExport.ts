// REQ-EXP-013: the deterministic, offline export path.
//
// Assembles a report from @rqml/core and hands it to the existing format
// generators. No language model, no network, no clock.

import { createHash } from 'crypto';
import { loadCore } from '../services/core';
import { buildDeterministicReport } from './deterministicReport';
import type { GeneratedReport } from './schemas/reportOutput';

/**
 * A digest of the specification source.
 *
 * This is the document's identity, and it replaces the generation timestamp in
 * the rendered output and in every embedded metadata field. Re-exporting an
 * unchanged specification therefore produces a byte-identical document, and any
 * change to the specification changes the digest — which is what an auditor
 * actually wants to know, unlike "the day someone pressed the button".
 */
export function specDigest(xml: string): string {
  return createHash('sha256').update(xml, 'utf8').digest('hex').slice(0, 16);
}

/**
 * A stable date derived from the specification itself.
 *
 * The generators embed a creation timestamp, and the OOXML containers put one
 * in every zip entry. Taking it from the clock makes two exports of the same
 * document differ; taking it from the content makes them identical while still
 * changing whenever the specification does.
 *
 * Mapped into a narrow window well inside the DOS epoch that zip entries use
 * (1980 onwards), so no container rejects it.
 */
export function stableDate(specHash: string): Date {
  const seed = parseInt(specHash.slice(0, 8), 16);
  // 2001-09-09T01:46:40Z plus up to ~1000 days, keyed to the digest.
  return new Date(1_000_000_000_000 + (seed % 86_400_000_000));
}

/**
 * Test-case ids covering each requirement, from incoming `covers` edges.
 *
 * `MatrixRow.tests` carries only outgoing `verifiedBy` edges, so a requirement
 * covered by a test case reads as verified with no evidence listed. In an audit
 * document that is an unsupported claim, which is worse than a missing one.
 */
export async function coversByRequirement(
  document: Parameters<Awaited<ReturnType<typeof loadCore>>['resolveTrace']>[0]
): Promise<Map<string, string[]>> {
  const core = await loadCore();
  const resolution = core.resolveTrace(document);
  const byRequirement = new Map<string, string[]>();

  for (const { edge, from, to } of resolution.edges) {
    if (edge.type !== 'covers') {continue;}
    const target = to.locator.kind === 'local' ? to.locator.id : undefined;
    const source = from.locator.kind === 'local' ? from.locator.id : undefined;
    if (!target || !source) {continue;}
    const list = byRequirement.get(target) ?? [];
    if (!list.includes(source)) {list.push(source);}
    byRequirement.set(target, list);
  }

  // Sorted so the rendered evidence column does not depend on document order.
  for (const list of byRequirement.values()) {list.sort();}
  return byRequirement;
}

export interface DeterministicExport {
  report: GeneratedReport;
  specHash: string;
  /** The date embedded in the document, derived from the specification. */
  date: Date;
}

/**
 * Build the deterministic report for a specification.
 *
 * `sections` optionally scopes the requirement rendering, mirroring the export
 * wizard's section picker. The matrix and coverage summary are always included:
 * they are what makes the artifact an audit document rather than a printout.
 */
export async function buildDeterministicExport(
  xml: string,
  options: { title?: string; sections?: readonly string[] } = {}
): Promise<DeterministicExport> {
  const core = await loadCore();
  const parsed = core.parse(xml);
  if (!parsed.ok) {
    throw new Error(`The specification does not parse: ${parsed.error.message}`);
  }

  const document = parsed.document;
  const fullOutline = core.buildOutline(document);
  const outline =
    options.sections && options.sections.length > 0
      ? core.projectOutline(fullOutline, { sections: [...options.sections] })
      : fullOutline;

  const specHash = specDigest(xml);

  return {
    specHash,
    date: stableDate(specHash),
    report: buildDeterministicReport({
      outline,
      matrix: core.buildMatrix(document),
      coverage: core.computeCoverage(document),
      coversByRequirement: await coversByRequirement(document),
      specHash,
      ...(options.title !== undefined ? { title: options.title } : {}),
    }),
  };
}
