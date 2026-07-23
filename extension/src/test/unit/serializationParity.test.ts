// The extension reads three RQML trace serializations and must see the same
// graph in each. The failure mode this guards against is silent: a reader that
// stops understanding a form yields zero edges rather than an error, so the
// matrix, trace graph and export views simply render an empty relationship set
// and look merely uninteresting rather than broken.
//
// The fixtures are the same document in all three forms — 2.2.0 produced from
// 2.1.0 by `rqml migrate`, so this also pins the migration's behaviour.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES = join(__dirname, '..', 'fixtures');

async function edgesOf(version: string) {
  const core = await import('@rqml/core');
  const xml = readFileSync(join(FIXTURES, `spec-${version}.rqml`), 'utf8');
  const result = core.parse(xml);
  if (!result.ok) throw new Error(`${version} failed to parse: ${result.error.message}`);
  return (result.document.trace ?? [])
    .map((e) => ({ id: e.id, type: e.type, from: e.from, to: e.to }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe('trace serialization parity', () => {
  it('reads the nested 2.1.0 form', async () => {
    expect(await edgesOf('2.1.0')).toHaveLength(3);
  });

  it('reads the compact 2.2.0 form', async () => {
    expect(await edgesOf('2.2.0')).toHaveLength(3);
  });

  it('reads the flat 2.0.1 form', async () => {
    // 2.0.1 carries endpoints as bare id attributes, so it can express only
    // local targets — the fixture omits the external edge for that reason.
    expect(await edgesOf('2.0.1')).toHaveLength(2);
  });

  it('produces an identical typed graph from 2.1.0 and its 2.2.0 migration', async () => {
    // The assertion that matters: `rqml migrate` changed the syntax and nothing
    // else. Comparing whole endpoint objects catches a locator kind or an
    // endpoint hint being dropped, not just a change in edge count.
    expect(await edgesOf('2.2.0')).toEqual(await edgesOf('2.1.0'));
  });

  it('preserves external locators and their kind hint through migration', async () => {
    const edge = (await edgesOf('2.2.0')).find((e) => e.id === 'E-EXTERNAL');
    expect(edge).toBeDefined();
    expect(edge!.from).toMatchObject({ kind: 'external', uri: 'src/thing.ts' });
    expect(edge!.to).toMatchObject({ kind: 'local', id: 'REQ-F-001' });
  });

  it('agrees with 2.0.1 on the edges 2.0.1 can express', async () => {
    const older = await edgesOf('2.0.1');
    const current = (await edgesOf('2.2.0')).filter((e) =>
      older.some((o) => o.id === e.id)
    );
    expect(current).toEqual(older);
  });
});
