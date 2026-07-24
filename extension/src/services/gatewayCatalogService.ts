// Fetch and cache the Vercel AI Gateway model catalogue.
//
// The gateway lists 300+ models and grows without the extension shipping, so
// the catalogue is fetched rather than hard-coded. Three constraints shape this:
//
//  * The picker must open without a network round trip. Anything else makes a
//    routine action fail in a tunnel or on a plane, so the list is cached and
//    the cache is served first.
//  * A user with no gateway key must still be able to browse. The SDK's
//    `getAvailableModels()` throws without one; the public endpoint does not.
//  * A failed fetch must not be an error the user has to dismiss. They asked to
//    pick a model, not to hear about a service.
//
// Parsing and curation live in models/gatewayCatalog.ts, free of vscode.

import * as vscode from 'vscode';
import { log } from './logger';
import {
  GATEWAY_MODELS_URL,
  isCacheFresh,
  parseGatewayModels,
  type GatewayCatalogCache,
  type GatewayCatalogEntry,
} from '../models/gatewayCatalog';

const CACHE_KEY = 'rqml.gatewayCatalog';
const FETCH_TIMEOUT_MS = 8000;

let context: vscode.ExtensionContext | undefined;

export function initializeGatewayCatalog(ctx: vscode.ExtensionContext): void {
  context = ctx;
}

/**
 * The gateway's models, from cache when fresh, otherwise fetched.
 *
 * Returns an empty list rather than throwing when the catalogue cannot be
 * obtained; the caller decides what to say about that.
 */
export async function getGatewayModels(force = false): Promise<GatewayCatalogEntry[]> {
  const cached = context?.globalState.get<GatewayCatalogCache>(CACHE_KEY);
  if (!force && isCacheFresh(cached, Date.now())) {
    return cached!.entries;
  }

  try {
    // A hung request would hang the picker, so the fetch is bounded.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let payload: unknown;
    try {
      const response = await fetch(GATEWAY_MODELS_URL, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`the gateway returned HTTP ${response.status}`);
      }
      payload = await response.json();
    } finally {
      clearTimeout(timer);
    }

    const entries = parseGatewayModels(payload);
    if (entries.length === 0) {
      throw new Error('the gateway returned no usable models');
    }

    await context?.globalState.update(CACHE_KEY, {
      fetchedAt: Date.now(),
      entries,
    } satisfies GatewayCatalogCache);
    log.info('Gateway', `catalogue refreshed: ${entries.length} models`);
    return entries;
  } catch (err) {
    // Stale is better than empty: a list from yesterday still lets the user
    // pick a model, which is what they were trying to do.
    if (cached?.entries.length) {
      log.info('Gateway', 'catalogue fetch failed; using the cached list', {
        error: err instanceof Error ? err.message : String(err),
      });
      return cached.entries;
    }
    log.error('Gateway', 'catalogue unavailable and nothing cached', err);
    return [];
  }
}
