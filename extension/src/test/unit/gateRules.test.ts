// REQ-GATE-004. The quick fixes key on the engine's rule identifiers, and a
// wrong literal produces no error anywhere — the action simply never appears,
// which looks identical to "there is nothing to fix". These tests drive the
// engine into each state and assert the rule it emits, so a rename upstream
// fails here rather than silently removing an affordance.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPINNABLE_RULES,
  PREMATURE_RULE,
  firstQuoted,
  requirementIn,
} from '../../services/gate/rules';
import { parseOrThrow } from './support';

const FIXTURES = join(__dirname, '..', 'fixtures');
const ARTIFACT = join(FIXTURES, 'src', 'thing.ts');
const ORIGINAL = 'export const thing = 1;\n';

const spec = () => readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8');

beforeEach(() => {
  mkdirSync(join(FIXTURES, 'src'), { recursive: true });
  writeFileSync(ARTIFACT, ORIGINAL);
});

afterEach(() => {
  writeFileSync(ARTIFACT, ORIGINAL);
  rmSync(join(FIXTURES, '.rqml'), { recursive: true, force: true });
});

describe('drift rule identifiers', () => {
  it('emits changed-implementation, which the re-pin action keys on', async () => {
    const core = await import('@rqml/core');
    const doc = parseOrThrow(core, spec());

    core.saveBaseline(FIXTURES, core.computeBaseline(doc, { baseDir: FIXTURES }));
    writeFileSync(ARTIFACT, 'export const thing = 999;\n');

    const drift = core.detectDrift(doc, {
      baseDir: FIXTURES,
      baseline: core.loadBaseline(FIXTURES),
    });

    const rules = drift.diagnostics.map((d) => d.rule);
    expect(rules).toContain('changed-implementation');
    expect(rules.some((r) => r && REPINNABLE_RULES.has(r))).toBe(true);
  });

  it('emits missing-implementation, which deliberately has no re-pin action', async () => {
    const core = await import('@rqml/core');
    const doc = parseOrThrow(core, spec());
    rmSync(ARTIFACT);

    const drift = core.detectDrift(doc, { baseDir: FIXTURES });
    const rules = drift.diagnostics.map((d) => d.rule);
    expect(rules).toContain('missing-implementation');
    // There is nothing to re-pin when the artifact is gone.
    expect(REPINNABLE_RULES.has('missing-implementation')).toBe(false);
  });
});

describe('coverage rule identifiers', () => {
  it('emits the premature-implementation rule the approve action keys on', async () => {
    const core = await import('@rqml/core');
    // The implements target becomes non-approved, which is what makes the edge premature.
    const xml = spec().replace(
      'id="REQ-F-001" type="FR" title="First" status="approved"',
      'id="REQ-F-001" type="FR" title="First" status="draft"'
    );
    const coverage = core.computeCoverage(parseOrThrow(core, xml));

    expect(coverage.prematureImplementations).toHaveLength(1);
    const rules = coverage.diagnostics.map((d) => d.rule);
    expect(rules).toContain(PREMATURE_RULE);
  });
});

describe('identifier extraction from engine messages', () => {
  it('takes the edge id from a drift message', () => {
    const message =
      'implements edge "E-EXTERNAL" points at "src/thing.ts", which has changed since approval.';
    expect(firstQuoted(message)).toBe('E-EXTERNAL');
  });

  it('takes the requirement id from a premature message, not the edge id', () => {
    // The edge id is quoted first, so a naive "first quoted" would approve the
    // wrong thing — or nothing.
    const message =
      'implements edge "E-EXTERNAL" targets requirement "REQ-F-001", which is not approved.';
    expect(requirementIn(message)).toBe('REQ-F-001');
  });

  it('returns nothing when a message names no identifier', () => {
    expect(firstQuoted('something went wrong')).toBeUndefined();
    expect(requirementIn('something went wrong')).toBeUndefined();
  });
});
