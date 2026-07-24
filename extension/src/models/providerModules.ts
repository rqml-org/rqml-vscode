// REQ-MDL-005: Provider SDK module loading
//
// The single place where a provider id becomes a real Vercel AI SDK module.
//
// Every specifier below is a STRING LITERAL inside `import()`. That matters for
// two reasons:
//
//  1. Static analysis. `await import(someVariable)` is invisible to bundlers,
//     to `npm ls`, and to `vsce ls` — nothing can tell that `@ai-sdk/groq` is
//     needed, so nothing warns when it is missing from the packaged extension.
//     A literal specifier is discoverable by tooling and by grep.
//  2. Compile-time exhaustiveness. Typing the map as `Record<ProviderId, …>`
//     means adding a `ProviderId` without adding its loader fails `tsc`, rather
//     than failing at runtime in front of a user.
//
// This is the bug that stranded five providers: `@ai-sdk/{xai,mistral,groq,
// deepseek,perplexity}` were declared in the *root* package.json rather than
// `extension/package.json`. In a dev checkout Node's parent-directory lookup
// still found them, so the failure was invisible; a packaged VSIX installs
// standalone with no parent to walk to, so `createModel` threw
// MODULE_NOT_FOUND for those five providers on every real install.
//
// As with `services/core.ts` (ADR-0002), `import()` is preserved verbatim under
// `module: Node16` CommonJS emit, so these load correctly whether the provider
// package ships CJS or ESM.

import type { ProviderId } from '../types/configuration';

/**
 * Provider id → loader for its SDK module.
 *
 * Exhaustive over `ProviderId` by construction: omit one and this file no
 * longer compiles.
 */
export const PROVIDER_MODULE_LOADERS: Record<ProviderId, () => Promise<unknown>> = {
  'anthropic': () => import('@ai-sdk/anthropic'),
  'openai': () => import('@ai-sdk/openai'),
  'google': () => import('@ai-sdk/google'),
  'azure-openai': () => import('@ai-sdk/azure'),
  'xai': () => import('@ai-sdk/xai'),
  'mistral': () => import('@ai-sdk/mistral'),
  'groq': () => import('@ai-sdk/groq'),
  'deepseek': () => import('@ai-sdk/deepseek'),
  'perplexity': () => import('@ai-sdk/perplexity'),
  // The gateway's factory is `createGateway` from the `ai` package, not an
  // `@ai-sdk/*` provider. Listed here so the map stays exhaustive over
  // ProviderId — that exhaustiveness is what made adding the gateway a compile
  // error until this line existed, which is the point of it.
  'vercel-gateway': () => import('ai'),
};

/** True when a loader is registered for `id`. */
export function hasProviderModule(id: ProviderId): boolean {
  return Object.prototype.hasOwnProperty.call(PROVIDER_MODULE_LOADERS, id);
}

/**
 * Load a provider's SDK module, failing with an actionable message rather than
 * a bare MODULE_NOT_FOUND.
 *
 * A missing module here is a packaging defect, not a user error, so the message
 * says so — the user cannot fix it by configuring anything.
 */
export async function loadProviderModule(
  id: ProviderId,
  displayName: string,
  sdkModule: string,
): Promise<Record<string, unknown>> {
  const loader = PROVIDER_MODULE_LOADERS[id];
  if (!loader) {
    throw new Error(
      `No SDK module is registered for provider "${id}". ` +
      `Add it to PROVIDER_MODULE_LOADERS in src/models/providerModules.ts.`,
    );
  }

  try {
    return (await loader()) as Record<string, unknown>;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${displayName} is unavailable because its SDK package "${sdkModule}" ` +
      `could not be loaded. This is a packaging problem with the extension, ` +
      `not a problem with your configuration — please report it. (${reason})`,
    );
  }
}
