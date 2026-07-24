// REQ-AGT-032: Centralised LLM error formatting for stream/object failures.
//
// The Vercel AI SDK does not throw on provider/stream errors during
// `streamText()` — it emits a `{ type: 'error', error }` part on `fullStream`.
// When that part is ignored, `await result.response` later throws the generic
// `NoOutputGeneratedError` ("No output generated. Check the stream for errors."),
// hiding the real cause. This helper turns the real error into a concise,
// user-facing message (status code + provider message + a hint) and logs the
// full detail (stack, response body) to the "RQML" Output channel.

import { APICallError, LoadAPIKeyError, NoObjectGeneratedError, NoOutputGeneratedError, AISDKError } from 'ai';
import { log } from './logger';
import { getConfigurationService } from './configurationService';
import { getModelCatalogService } from './modelCatalogService';

export interface LlmErrorContext {
  /** Logical area for log lines, e.g. 'agent' | 'implement' | 'agent-bg' | 'export'. */
  area: string;
  /** Error captured from the fullStream `error` part, if any. Preferred over downstreamError. */
  streamError?: unknown;
  /** Error thrown downstream, e.g. by `await result.response` or `generateObject`. */
  downstreamError?: unknown;
}

const OUTPUT_HINT = 'See Output → RQML for details.';

/**
 * Format an LLM failure into a concise, user-facing message AND log full detail
 * to the RQML Output channel. The returned message ends with the Output hint.
 */
export function formatLlmError(ctx: LlmErrorContext): string {
  const cause = ctx.streamError ?? unwrapCause(ctx.downstreamError);
  const concise = describe(cause);
  const suffix = contextSuffix();

  // Full detail to the Output channel.
  log.error(ctx.area, concise, cause);
  if (APICallError.isInstance(cause)) {
    log.info(ctx.area, 'APICallError detail', {
      url: cause.url,
      statusCode: cause.statusCode,
      responseBody: cause.responseBody,
      isRetryable: cause.isRetryable,
    });
  }

  return `${concise}${suffix}\n\n${OUTPUT_HINT}`;
}

/**
 * `NoOutputGeneratedError` / `NoObjectGeneratedError` wrap the real provider
 * error in `.cause`. Recover it so we can format the underlying APICallError
 * even when no stream `error` part was captured (e.g. the export path).
 */
function unwrapCause(error: unknown): unknown {
  if ((NoOutputGeneratedError.isInstance(error) || NoObjectGeneratedError.isInstance(error))) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined && cause !== null) {
      return cause;
    }
  }
  return error;
}

/**
 * Gateway-specific failures, which the generic branches would report unhelpfully.
 *
 * The gateway sits between the user and an upstream provider, so its errors
 * describe two different systems and the remedies differ. Reported as
 * "HTTP 402" the user cannot tell a spent credit balance from a bad key.
 *
 * Loaded lazily and by name so this module keeps working if the gateway
 * package is ever absent — these branches simply do not fire.
 */
function describeGatewayError(cause: unknown): string | undefined {
  const err = cause as { name?: string; message?: string; modelId?: string };
  if (typeof err?.name !== 'string' || !err.name.startsWith('Gateway')) return undefined;

  switch (err.name) {
    case 'GatewayAuthenticationError':
      return (
        'The AI Gateway rejected the API key. ' +
        "Run 'RQML: Add LLM Provider' to set a valid key, or select a different provider."
      );
    case 'GatewayForbiddenError':
      return (
        'The AI Gateway refused this request. This usually means the account lacks ' +
        'access to the model, or its credit balance is exhausted — check the Vercel dashboard.'
      );
    case 'GatewayModelNotFoundError':
      return (
        `The AI Gateway does not offer "${err.modelId ?? 'that model'}". ` +
        "Run 'RQML: Select Model' to pick from the current catalogue — the gateway's model list changes."
      );
    case 'GatewayRateLimitError':
      return 'The AI Gateway rate-limited this request. Wait a moment and retry.';
    case 'GatewayFailedDependencyError':
      return (
        'The AI Gateway reached the upstream provider and the provider failed. ' +
        'This is an outage upstream of Vercel, not a problem with your configuration.'
      );
    case 'GatewayInternalServerError':
      return 'The AI Gateway itself failed. This is a service-side problem; retry shortly.';
    case 'GatewayInvalidRequestError':
      return `The AI Gateway rejected the request as invalid: ${err.message ?? 'no detail given'}.`;
    default:
      return `AI Gateway error (${err.name}): ${err.message ?? 'no detail given'}.`;
  }
}

/** Build the concise, user-facing description for a cause. */
function describe(cause: unknown): string {
  // Checked before APICallError, which some gateway errors also satisfy — the
  // generic branch would then report a bare HTTP status and lose the remedy.
  const gateway = describeGatewayError(cause);
  if (gateway) {return gateway;}

  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode;
    const providerMessage = parseProviderMessage(cause.responseBody) ?? cause.message;
    const hint = statusHint(status);
    const retryable = cause.isRetryable ? ' (retryable)' : '';
    const statusLabel = status !== undefined ? `HTTP ${status}` : 'API call failed';
    return `${statusLabel}: ${providerMessage}.${hint ? ` ${hint}` : ''}${retryable}`;
  }

  if (LoadAPIKeyError.isInstance(cause)) {
    return "No or invalid API key. Run 'RQML: Add LLM Provider' to configure one.";
  }

  if (NoObjectGeneratedError.isInstance(cause)) {
    const text = (cause as { text?: string }).text;
    const extra = text ? ` Model output: ${truncate(text, 200)}` : '';
    return `The model returned no structured output (invalid JSON or refusal).${extra}`;
  }

  if (NoOutputGeneratedError.isInstance(cause)) {
    return 'The model produced no output — a provider error was not surfaced.';
  }

  if (AISDKError.isInstance(cause)) {
    return cause.message;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  // Raw provider error objects (e.g. an OpenAI fullStream `error` part is a
  // plain object like `{ type: 'error', error: { code, message } }`, not an
  // Error instance). Dig out a human-readable message and code.
  const raw = extractRawMessage(cause);
  if (raw) {
    return raw;
  }

  return String(cause);
}

/** Extract a message (and code, if present) from a plain provider error object. */
function extractRawMessage(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object') { return undefined; }
  const c = cause as Record<string, unknown>;

  // Nested provider error: `{ error: { code?, message } }`.
  if (c.error && typeof c.error === 'object') {
    const inner = c.error as Record<string, unknown>;
    if (typeof inner.message === 'string' && inner.message.trim()) {
      const code = typeof inner.code === 'string' ? inner.code : (typeof inner.type === 'string' ? inner.type : undefined);
      return code ? `${inner.message} (${code})` : inner.message;
    }
  }
  if (typeof c.error === 'string' && c.error.trim()) { return c.error; }
  if (typeof c.message === 'string' && c.message.trim()) { return c.message; }
  return undefined;
}

/** Map an HTTP status code to an actionable hint. */
function statusHint(status: number | undefined): string {
  if (status === undefined) { return ''; }
  if (status === 401 || status === 403) {
    return "Authentication failed — check your API key (RQML: Add LLM Provider).";
  }
  if (status === 429) {
    return 'Rate limited — wait and retry, or check your plan quota.';
  }
  if (status === 404) {
    return 'Model or endpoint not found — verify the model id (RQML: Select Model).';
  }
  if (status === 400) {
    return 'Bad request — the model may not support a parameter (e.g. reasoning) or the request was malformed.';
  }
  if (status >= 500) {
    return 'Provider outage / server error — try again shortly.';
  }
  return '';
}

/** Extract a human-readable message from a provider JSON error body. */
function parseProviderMessage(responseBody: string | undefined): string | undefined {
  if (!responseBody) { return undefined; }
  try {
    const parsed = JSON.parse(responseBody);
    const message =
      parsed?.error?.message ??
      parsed?.message ??
      (typeof parsed?.error === 'string' ? parsed.error : undefined);
    if (typeof message === 'string' && message.trim()) {
      return truncate(message.trim(), 300);
    }
  } catch {
    // Not JSON — fall through to the raw (truncated) body.
  }
  return truncate(responseBody.trim(), 300);
}

/** ` (provider: OpenAI, model: gpt-4o)` for the active model, or '' if unknown. */
function contextSuffix(): string {
  try {
    const active = getConfigurationService().getActiveModel();
    if (!active) { return ''; }
    const displayName = getModelCatalogService().getProviderEntry(active.providerId)?.displayName ?? active.providerId;
    return ` (provider: ${displayName}, model: ${active.modelId})`;
  } catch {
    return '';
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
