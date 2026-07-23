// REQ-GATE-001/002: the slash commands that answer checkable questions must
// answer them the way the gate does.
//
// The regression these guard is specific and was measured on this repository:
// /sync counted any edge as coverage and reported 37 untraced where the engine
// reports 142 orphans and 148 unverified; /trace read a view model that erases
// every non-local endpoint, losing all 13 implements edges.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  describeLocator,
  renderDiagnostics,
  renderLint,
  renderStatus,
  renderSync,
  renderTrace,
  toLintStrictness,
} from '../../services/report/specReports';
import { parseOrThrow } from './support';

const FIXTURES = join(__dirname, '..', 'fixtures');
const spec = () => readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8');

async function analysed() {
  const core = await import('@rqml/core');
  const document = parseOrThrow(core, spec());
  return {
    core,
    document,
    coverage: core.computeCoverage(document),
    drift: core.detectDrift(document, { baseDir: FIXTURES }),
  };
}

describe('toLintStrictness', () => {
  it('maps the project vocabulary onto core’s narrower one', () => {
    expect(toLintStrictness('relaxed')).toBe('lenient');
    expect(toLintStrictness('standard')).toBe('standard');
    expect(toLintStrictness('strict')).toBe('strict');
  });

  it('maps certified to strict rather than falling back to the default', () => {
    // core has no `certified`; defaulting would make the most demanding level
    // lint the least strictly, which is the wrong way round.
    expect(toLintStrictness('certified')).toBe('strict');
  });

  it('defaults an unknown level to standard', () => {
    expect(toLintStrictness('nonsense')).toBe('standard');
  });
});

describe('renderStatus', () => {
  it('reports the engine’s coverage figures', async () => {
    const { document, coverage, drift } = await analysed();
    const out = renderStatus(document, coverage, drift, 'standard');
    expect(out).toContain(`${coverage.requirements.length} requirement`);
    expect(out).toContain(`${coverage.unverifiedRequirements.length} requirement`);
    expect(out).toContain('standard');
  });

  it('says where the figures come from, so they are not mistaken for an opinion', async () => {
    const { document, coverage, drift } = await analysed();
    expect(renderStatus(document, coverage, drift, 'standard')).toMatch(/@rqml\/core/);
  });
});

describe('renderSync', () => {
  it('counts only implementation and verification coverage, not any edge', async () => {
    const { coverage, drift } = await analysed();
    const out = renderSync(coverage, drift);
    // The old implementation would have said "all requirements have trace
    // edges" here, because dependsOn edges touch them.
    expect(out).toContain('with no implementation link');
    expect(out).toContain('with no verification link');
  });

  it('reports drift separately from coverage', async () => {
    const { coverage, drift } = await analysed();
    expect(renderSync(coverage, drift)).toContain('changed since baseline');
  });
});

describe('renderTrace', () => {
  const edges = [
    {
      edge: { id: 'E-EXTERNAL', type: 'implements' },
      from: { locator: { kind: 'external', uri: 'src/thing.ts' } },
      to: { locator: { kind: 'local', id: 'REQ-F-001' } },
    },
    {
      edge: { id: 'E-LOCAL', type: 'satisfies' },
      from: { locator: { kind: 'local', id: 'REQ-F-001' } },
      to: { locator: { kind: 'local', id: 'GOAL-ONE' } },
    },
  ];

  it('renders an external endpoint as its path, not as an empty string', () => {
    // The defect: the view model set non-local endpoints to '', so this line
    // used to render with nothing on the left of the arrow.
    const out = renderTrace('REQ-F-001', edges, describeLocator);
    expect(out).toContain('src/thing.ts');
    expect(out).not.toMatch(/`` →/);
  });

  it('separates incoming from outgoing', () => {
    const out = renderTrace('REQ-F-001', edges, describeLocator);
    expect(out).toContain('**Incoming**');
    expect(out).toContain('**Outgoing**');
  });

  it('says so plainly when nothing references the artifact', () => {
    expect(renderTrace('REQ-NOPE', edges, describeLocator)).toContain('no trace edges');
  });
});

describe('describeLocator', () => {
  it('handles all three locator kinds', () => {
    expect(describeLocator({ kind: 'local', id: 'REQ-A' })).toBe('REQ-A');
    expect(describeLocator({ kind: 'external', uri: 'src/a.ts' })).toBe('src/a.ts');
    expect(describeLocator({ kind: 'doc', docUri: 'other.rqml', id: 'REQ-B' })).toBe(
      'other.rqml#REQ-B'
    );
  });
});

describe('renderLint', () => {
  it('says plainly when there is nothing to report', () => {
    expect(renderLint([], 'standard')).toContain('no findings');
  });

  it('groups findings by severity', async () => {
    const core = await import('@rqml/core');
    const findings = core.lint(parseOrThrow(core, spec()), { strictness: 'strict' });
    const out = renderLint(findings, 'strict');
    if (findings.length > 0) {
      expect(out).toMatch(/\*\*(Errors|Warnings|Infos)\*\*/);
    }
    expect(out).toContain('strict');
  });
});

describe('renderDiagnostics', () => {
  const diag = (severity: string, message: string) =>
    ({ severity, message, source: 'validate' }) as never;

  it('orders errors before warnings before info', () => {
    const out = renderDiagnostics([
      diag('info', 'an info'),
      diag('error', 'an error'),
      diag('warning', 'a warning'),
    ]).join('\n');
    expect(out.indexOf('Errors')).toBeLessThan(out.indexOf('Warnings'));
    expect(out.indexOf('Warnings')).toBeLessThan(out.indexOf('Infos'));
  });

  it('caps each group so a large report stays readable', () => {
    const many = Array.from({ length: 50 }, (_, i) => diag('error', `error ${i}`));
    const out = renderDiagnostics(many, 20).join('\n');
    expect(out).toContain('…and 30 more');
  });

  it('renders nothing for an empty set', () => {
    expect(renderDiagnostics([])).toEqual([]);
  });
});
