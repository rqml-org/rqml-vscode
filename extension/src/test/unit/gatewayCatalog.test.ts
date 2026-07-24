// The gateway catalogue is a third-party payload of 300+ entries that changes
// without this extension shipping. Parsing it defensively matters: a picker
// that throws on an unexpected field is worse than one showing fewer models.

import { describe, expect, it } from 'vitest';
import {
  GATEWAY_CACHE_TTL_MS,
  GATEWAY_MODELS_URL,
  isCacheFresh,
  parseGatewayModels,
} from '../../models/gatewayCatalog';

const model = (over: Record<string, unknown> = {}) => ({
  id: 'anthropic/claude-sonnet-4.5',
  name: 'Claude Sonnet 4.5',
  type: 'language',
  context_window: 200000,
  modalities: { input: ['text'], output: ['text'] },
  ...over,
});

describe('parseGatewayModels', () => {
  it('reads the gateway’s documented shape', () => {
    const [entry] = parseGatewayModels({ data: [model()] });
    expect(entry).toMatchObject({
      modelId: 'anthropic/claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
      vendor: 'anthropic',
      contextWindow: 200000,
    });
  });

  it('derives the vendor from the namespaced id', () => {
    const entries = parseGatewayModels({
      data: [model({ id: 'openai/gpt-5', name: 'GPT-5' }), model({ id: 'meta/llama-4', name: 'Llama 4' })],
    });
    expect(entries.map((e) => e.vendor)).toEqual(['meta', 'openai']);
  });

  it('flags models the gateway says can reason', () => {
    const [plain] = parseGatewayModels({ data: [model()] });
    const [reasoning] = parseGatewayModels({ data: [model({ reasoning_options: { effort: [] } })] });
    expect(plain.reasoning).toBe(false);
    expect(reasoning.reasoning).toBe(true);
  });

  it('drops models the agent cannot drive', () => {
    // The catalogue also lists embedding and image models.
    const entries = parseGatewayModels({
      data: [
        model(),
        model({ id: 'openai/text-embedding-3', type: 'embedding' }),
        model({ id: 'openai/dall-e', modalities: { input: ['text'], output: ['image'] } }),
      ],
    });
    expect(entries.map((e) => e.modelId)).toEqual(['anthropic/claude-sonnet-4.5']);
  });

  it('sorts deterministically, so the picker does not reshuffle between openings', () => {
    const payload = {
      data: [
        model({ id: 'openai/gpt-5', name: 'GPT-5' }),
        model({ id: 'anthropic/opus', name: 'Opus' }),
        model({ id: 'anthropic/haiku', name: 'Haiku' }),
      ],
    };
    const first = parseGatewayModels(payload).map((e) => e.modelId);
    const second = parseGatewayModels({ data: [...payload.data].reverse() }).map((e) => e.modelId);
    expect(first).toEqual(second);
    expect(first).toEqual(['anthropic/haiku', 'anthropic/opus', 'openai/gpt-5']);
  });

  it('skips malformed entries rather than throwing', () => {
    const entries = parseGatewayModels({
      data: [model(), null, {}, { id: 42 }, { id: 'no-slash' }, 'nonsense'],
    });
    expect(entries).toHaveLength(1);
  });

  it('returns nothing for a payload that is not the expected shape', () => {
    expect(parseGatewayModels(undefined)).toEqual([]);
    expect(parseGatewayModels({})).toEqual([]);
    expect(parseGatewayModels({ data: 'not an array' })).toEqual([]);
    expect(parseGatewayModels([])).toEqual([]);
  });

  it('falls back to the id when a model has no display name', () => {
    const [entry] = parseGatewayModels({ data: [model({ name: undefined })] });
    expect(entry.displayName).toBe('anthropic/claude-sonnet-4.5');
  });

  it('accepts a model that omits type and modalities', () => {
    // Absent fields must not be read as "not a language model" — the payload
    // is third-party and need not populate everything.
    const entries = parseGatewayModels({
      data: [{ id: 'vendor/model', name: 'Model' }],
    });
    expect(entries).toHaveLength(1);
  });
});

describe('isCacheFresh', () => {
  const now = 1_000_000_000_000;
  const cache = (over: Record<string, unknown> = {}) => ({
    fetchedAt: now,
    entries: [{ modelId: 'a/b', displayName: 'B', vendor: 'a', reasoning: false }],
    ...over,
  });

  it('accepts a cache within the TTL', () => {
    expect(isCacheFresh(cache(), now + GATEWAY_CACHE_TTL_MS - 1)).toBe(true);
  });

  it('rejects a cache past the TTL', () => {
    expect(isCacheFresh(cache(), now + GATEWAY_CACHE_TTL_MS + 1)).toBe(false);
  });

  it('rejects an empty cache, which would show an empty picker', () => {
    expect(isCacheFresh(cache({ entries: [] }), now)).toBe(false);
  });

  it('rejects no cache at all', () => {
    expect(isCacheFresh(undefined, now)).toBe(false);
  });
});

describe('the endpoint', () => {
  it('is the public list, which needs no API key', () => {
    // The SDK's getAvailableModels() throws GatewayAuthenticationError without
    // a key, so it cannot populate a picker for someone who has not signed up.
    expect(GATEWAY_MODELS_URL).toBe('https://ai-gateway.vercel.sh/v1/models');
  });
});
