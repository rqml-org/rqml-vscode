// Five of the nine advertised providers were broken in every packaged install:
// their SDK packages were declared in the repository-root package.json rather
// than the extension's own. A development checkout resolved them anyway through
// Node's parent-directory lookup, so the failure was invisible locally, and the
// SDK was reached through `await import(provider.sdkModule)` — a computed
// specifier no tool could analyse.
//
// This test is the thing that would have caught it. It actually imports every
// provider module, so it fails if a package is missing from THIS package.json
// rather than merely absent from the catalogue.

import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '../../models/catalog';
import { PROVIDER_MODULE_LOADERS, hasProviderModule, loadProviderModule } from '../../models/providerModules';

describe('provider SDK loading', () => {
  it('registers a loader for every provider in the catalogue', () => {
    const missing = PROVIDERS.filter((p) => !hasProviderModule(p.id)).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it('registers no loader that the catalogue does not offer', () => {
    const ids = new Set(PROVIDERS.map((p) => p.id));
    const orphans = Object.keys(PROVIDER_MODULE_LOADERS).filter((id) => !ids.has(id as never));
    expect(orphans).toEqual([]);
  });

  it.each(PROVIDERS.map((p) => [p.id, p.displayName, p.sdkModule, p.sdkFactory] as const))(
    'loads %s (%s) and finds its factory',
    async (id, displayName, sdkModule, sdkFactory) => {
      const mod = await loadProviderModule(id, displayName, sdkModule);
      expect(typeof mod[sdkFactory], `${sdkModule} should export ${sdkFactory}`).toBe('function');
    }
  );

  it('fails loudly for an id with no registered loader', async () => {
    // The exhaustive Record makes this unreachable through the type system, so
    // the cast is the only way to reach the guard — but the guard has to exist,
    // because the catalogue is data and could gain an entry without a loader.
    await expect(
      loadProviderModule('not-a-provider' as never, 'Nonexistent', '@ai-sdk/nope')
    ).rejects.toThrow(/no sdk module is registered/i);
  });
});
