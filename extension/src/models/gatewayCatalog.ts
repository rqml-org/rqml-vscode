// The Vercel AI Gateway model catalogue.
//
// Fetched from the gateway's public model list, which needs no API key — worth
// stating because the SDK's own `getAvailableModels()` does: called without a
// key it throws GatewayAuthenticationError, so it cannot populate a picker for
// a user who has not signed up yet. The public endpoint can.
//
// The list is large (300+ models and growing) and dumping it into a QuickPick
// would be worse than the curated catalogue it sits beside. It is therefore
// filtered to text models and sorted deterministically, and the caller caches
// it — a model picker must still open when the network does not answer.
//
// Kept free of any `vscode` import so the parsing and curation can be tested
// without an extension host.

/** The gateway's public catalogue. No API key required. */
export const GATEWAY_MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models';

/** One model as the gateway describes it. Only the fields we rely on. */
export interface GatewayModel {
  id: string;
  name?: string;
  description?: string;
  context_window?: number;
  max_tokens?: number;
  type?: string;
  modalities?: { input?: string[]; output?: string[] };
  reasoning_options?: unknown;
}

/** A catalogue entry in the extension's own shape. */
export interface GatewayCatalogEntry {
  /** The gateway model id, e.g. "anthropic/claude-sonnet-4.5". */
  modelId: string;
  displayName: string;
  /** The upstream provider, taken from the id's first segment. */
  vendor: string;
  contextWindow?: number;
  /** True when the gateway advertises reasoning options for this model. */
  reasoning: boolean;
}

/**
 * Parse the gateway's response into catalogue entries.
 *
 * Defensive by design: this is a third-party payload that can change shape
 * without notice, and a picker that throws is worse than one that shows fewer
 * models. Anything unrecognisable is skipped rather than propagated.
 */
export function parseGatewayModels(payload: unknown): GatewayCatalogEntry[] {
  const list = (payload as { data?: unknown[] })?.data;
  if (!Array.isArray(list)) return [];

  const entries: GatewayCatalogEntry[] = [];
  for (const raw of list) {
    const model = raw as GatewayModel;
    if (typeof model?.id !== 'string' || !model.id.includes('/')) continue;

    // Only text-generating models. The gateway also lists embedding and image
    // models, which the agent cannot drive.
    if (model.type !== undefined && model.type !== 'language') continue;
    const outputs = model.modalities?.output;
    if (Array.isArray(outputs) && !outputs.includes('text')) continue;

    entries.push({
      modelId: model.id,
      displayName: model.name?.trim() || model.id,
      vendor: model.id.slice(0, model.id.indexOf('/')),
      contextWindow: typeof model.context_window === 'number' ? model.context_window : undefined,
      reasoning: model.reasoning_options != null,
    });
  }

  // Sorted so the picker order is stable across fetches — the list arrives in
  // whatever order the service chose, and a picker that reshuffles between
  // openings is disorienting.
  return entries.sort(
    (a, b) => a.vendor.localeCompare(b.vendor) || a.displayName.localeCompare(b.displayName)
  );
}

/** Cached catalogue plus the time it was fetched. */
export interface GatewayCatalogCache {
  fetchedAt: number;
  entries: GatewayCatalogEntry[];
}

/** How long a cached catalogue stays fresh. */
export const GATEWAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isCacheFresh(cache: GatewayCatalogCache | undefined, now: number): boolean {
  return !!cache && now - cache.fetchedAt < GATEWAY_CACHE_TTL_MS && cache.entries.length > 0;
}
