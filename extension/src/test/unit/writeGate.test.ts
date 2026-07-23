// REQ-GATE-005 AC-02 and REQ-AGT-030.
//
// The path cases below are the actual defect: the previous Spec-mode guard
// tested the raw tool input with a string prefix, so a path beginning
// ".rqml/adr/" was admitted no matter where it resolved to.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveWorkspacePath,
  isSpecModeAllowedWritePath,
  blockedWrite,
} from '../../services/gate/writeGate';

const ROOT = '/tmp/ws';
const FIXTURES = join(__dirname, '..', 'fixtures');

describe('resolveWorkspacePath', () => {
  it('accepts an ordinary relative path', () => {
    expect(resolveWorkspacePath(ROOT, 'src/a.ts')).toBe('src/a.ts');
  });

  it('normalises a leading ./', () => {
    expect(resolveWorkspacePath(ROOT, './src/a.ts')).toBe('src/a.ts');
  });

  it('accepts traversal that stays inside the workspace', () => {
    expect(resolveWorkspacePath(ROOT, 'src/../src/a.ts')).toBe('src/a.ts');
  });

  it('refuses traversal that escapes the workspace', () => {
    expect(resolveWorkspacePath(ROOT, '../outside.ts')).toBeUndefined();
    expect(resolveWorkspacePath(ROOT, '.rqml/adr/../../../evil.ts')).toBeUndefined();
  });

  it('refuses an absolute path outside the workspace', () => {
    expect(resolveWorkspacePath(ROOT, '/etc/passwd')).toBeUndefined();
  });

  it('accepts an absolute path inside the workspace', () => {
    expect(resolveWorkspacePath(ROOT, '/tmp/ws/src/a.ts')).toBe('src/a.ts');
  });

  it('refuses a sibling directory with a shared prefix', () => {
    // /tmp/ws-other is not inside /tmp/ws, despite the string prefix.
    expect(resolveWorkspacePath(ROOT, '/tmp/ws-other/a.ts')).toBeUndefined();
  });
});

describe('isSpecModeAllowedWritePath', () => {
  it('allows ADRs and plans', () => {
    expect(isSpecModeAllowedWritePath('.rqml/adr/0001-thing.md')).toBe(true);
    expect(isSpecModeAllowedWritePath('.rqml/plan.md')).toBe(true);
    expect(isSpecModeAllowedWritePath('.rqml/plans/stage-1.md')).toBe(true);
  });

  it('refuses project source', () => {
    expect(isSpecModeAllowedWritePath('src/extension.ts')).toBe(false);
    expect(isSpecModeAllowedWritePath('package.json')).toBe(false);
  });

  it('refuses source reached by traversal through an allowed prefix', () => {
    // The defect: this string starts with ".rqml/adr/" but resolves to source.
    const escaped = resolveWorkspacePath(ROOT, '.rqml/adr/../../src/extension.ts');
    expect(escaped).toBe('src/extension.ts');
    expect(isSpecModeAllowedWritePath(escaped!)).toBe(false);
  });
});

describe('blockedWrite', () => {
  const doc = async () => {
    const core = await import('@rqml/core');
    // REQ-F-001 is the implements target; make it draft so the edge is premature.
    const xml = readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8').replace(
      'id="REQ-F-001" type="FR" title="First" status="approved"',
      'id="REQ-F-001" type="FR" title="First" status="draft"'
    );
    return { core, document: core.parse(xml).document };
  };

  it('blocks a write to code implementing a non-approved requirement', async () => {
    const { core, document } = await doc();
    const blocked = blockedWrite(core.approvalGate, document, 'src/thing.ts');
    expect(blocked).toBeDefined();
    expect(blocked!.requirementId).toBe('REQ-F-001');
    expect(blocked!.edgeId).toBe('E-EXTERNAL');
  });

  it('names the requirement and how to unblock it', async () => {
    const { core, document } = await doc();
    const blocked = blockedWrite(core.approvalGate, document, 'src/thing.ts');
    expect(blocked!.reason).toContain('REQ-F-001');
    expect(blocked!.reason).toContain('not approved');
    // A refusal the user cannot act on is just an obstacle.
    expect(blocked!.reason).toMatch(/approve/i);
  });

  it('allows a write to a file no trace edge governs', async () => {
    const { core, document } = await doc();
    expect(blockedWrite(core.approvalGate, document, 'src/unrelated.ts')).toBeUndefined();
  });

  it('allows the write once the requirement is approved', async () => {
    const core = await import('@rqml/core');
    const xml = readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8');
    const document = core.parse(xml).document;
    expect(blockedWrite(core.approvalGate, document, 'src/thing.ts')).toBeUndefined();
  });
});
