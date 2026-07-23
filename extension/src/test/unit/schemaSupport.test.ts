// Guards the defect that motivated the engine upgrade: the extension shipped a
// schema catalogue that knew only 2.0.1 and 2.1.0, while `rqml init` had been
// producing 2.2.0 for some time. The editor therefore could not validate a
// document the CLI handled fine, and nothing failed loudly enough to notice.
//
// These assertions are about the *engine the extension actually resolves*, not
// about a version number written down somewhere, so they fail if a dependency
// range silently pins an older catalogue again.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES = join(__dirname, '..', 'fixtures');

describe('schema catalogue', () => {
  it('recognises every version the extension claims to read', async () => {
    const schema = await import('@rqml/schema');
    expect(schema.supportedSchemaVersions()).toEqual(['2.0.1', '2.1.0', '2.2.0']);
  });

  it('creates new specifications at 2.2.0', async () => {
    const schema = await import('@rqml/schema');
    expect(schema.DEFAULT_SCHEMA_VERSION).toBe('2.2.0');
  });

  it('resolves XSD text for each supported version', async () => {
    const schema = await import('@rqml/schema');
    for (const version of schema.supportedSchemaVersions()) {
      expect(schema.resolveSchema(version), version).toBeTruthy();
    }
  });

  it('derives namespace and schemaLocation rather than assembling them', async () => {
    const schema = await import('@rqml/schema');
    // specService builds the init template from these two. They were previously
    // interpolated by hand in two places and could disagree.
    expect(schema.schemaNamespace('2.2.0')).toBe('https://rqml.org/schema/2.2.0');
    expect(schema.schemaUrl('2.2.0')).toBe('https://rqml.org/schema/rqml-2.2.0.xsd');
  });

  it('validates a 2.2.0 document — the case that used to be impossible', async () => {
    const { validate } = await import('@rqml/core/validate');
    const xml = readFileSync(join(FIXTURES, 'spec-2.2.0.rqml'), 'utf8');
    expect(validate(xml).diagnostics).toEqual([]);
  });

  it('still validates the older versions it promises to read', async () => {
    const { validate } = await import('@rqml/core/validate');
    for (const version of ['2.0.1', '2.1.0']) {
      const xml = readFileSync(join(FIXTURES, `spec-${version}.rqml`), 'utf8');
      expect(validate(xml).diagnostics, version).toEqual([]);
    }
  });
});
