// REQ-GATE-001 AC-GATE-001-01/02: the editor's verdict must equal the CLI's.
//
// These run the real engine over real fixtures, because the risk being guarded
// is a composition drifting from `rqml check` — which a mocked engine could not
// detect.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, coverageBlocks, summarise, GATE_EXIT } from '../../services/gate/verdict';

const FIXTURES = join(__dirname, '..', 'fixtures');
const read = (v: string) => readFileSync(join(FIXTURES, `spec-${v}.rqml`), 'utf8');

describe('coverageBlocks', () => {
  it('blocks only at strict and certified', () => {
    expect(coverageBlocks('relaxed')).toBe(false);
    expect(coverageBlocks('standard')).toBe(false);
    expect(coverageBlocks('strict')).toBe(true);
    expect(coverageBlocks('certified')).toBe(true);
  });
});

describe('evaluate', () => {
  it('passes a clean specification at standard', async () => {
    const v = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'standard' });
    expect(v.verdict).toBe('pass');
    expect(v.exitCode).toBe(GATE_EXIT.OK);
  });

  it('reports the schema version it validated against', async () => {
    const v = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'standard' });
    expect(v.schemaVersion).toBe('2.2.0');
  });

  it('fails with the validation exit code on a schema-invalid document', async () => {
    const broken = read('2.2.0').replace('status="approved"', 'status="not-a-status"');
    const v = await evaluate(broken, { baseDir: FIXTURES, strictness: 'standard' });
    expect(v.verdict).toBe('fail');
    expect(v.exitCode).toBe(GATE_EXIT.VALIDATION);
  });

  it('does not run integrity when validation failed', async () => {
    // The CLI skips integrity for invalid documents. Running it anyway reports a
    // duplicate id twice under 2.2.0, because the schema's xs:unique also fires.
    const dup = read('2.2.0').replace('id="REQ-F-002"', 'id="REQ-F-001"');
    const v = await evaluate(dup, { baseDir: FIXTURES, strictness: 'standard' });
    const duplicateReports = v.diagnostics.filter((d) => /duplicate/i.test(d.message ?? ''));
    expect(duplicateReports).toHaveLength(1);
  });

  it('surfaces coverage at standard without letting it fail the gate', async () => {
    // The fixture has an unverified requirement and no test edges, so coverage
    // is non-empty — but standard does not count it.
    const v = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'standard' });
    expect(v.coverage).toBeDefined();
    expect(v.coverage!.unverifiedRequirements.length).toBeGreaterThan(0);
    expect(v.coverageBlocks).toBe(false);
    expect(v.verdict).toBe('pass');
  });

  it('fails the same document at strict, where coverage counts', async () => {
    const v = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'strict' });
    expect(v.coverageBlocks).toBe(true);
    expect(v.verdict).toBe('fail');
    expect(v.exitCode).toBe(GATE_EXIT.CHECK);
  });

  it('omits coverage diagnostics when coverage does not block', async () => {
    // The CLI includes them only when they count toward the verdict; showing
    // them at standard would report problems the gate does not act on.
    const standard = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'standard' });
    const strict = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'strict' });
    expect(strict.diagnostics.length).toBeGreaterThan(standard.diagnostics.length);
  });

  it('does not count unimplementedRequirements toward the verdict', async () => {
    // Counting six arrays instead of five would make the editor stricter than
    // the gate of record, so a repository could pass CI and fail in the editor.
    const v = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'strict' });
    const c = v.coverage!;
    const counted =
      c.uncoveredGoals.length +
      c.unverifiedRequirements.length +
      c.orphanRequirements.length +
      c.unimplementedApprovedRequirements.length +
      c.prematureImplementations.length;
    // Present in the report, absent from the count.
    expect(c.unimplementedRequirements.length).toBeGreaterThan(0);
    expect(counted).toBeGreaterThan(0);
    expect(v.verdict).toBe('fail');
  });

  it('reaches the same verdict for a document in either serialization', async () => {
    const a = await evaluate(read('2.1.0'), { baseDir: FIXTURES, strictness: 'strict' });
    const b = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'strict' });
    expect(b.verdict).toBe(a.verdict);
    expect(b.exitCode).toBe(a.exitCode);
  });

  it('summarises in the CLI’s phrasing', async () => {
    const v = await evaluate(read('2.2.0'), { baseDir: FIXTURES, strictness: 'standard' });
    expect(summarise(v)).toBe('✓ check pass (standard)');
  });
});
