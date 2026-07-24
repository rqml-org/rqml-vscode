# ADR-0012: The AI Gateway is one optional provider, never a default

- **Status**: Accepted
- **Date**: 2026-07-24
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-MDL-005`, `REQ-CFG-013`, `REQ-EXP-013`
- **Related ADRs**: `ADR-0005` (agent freeze), `ADR-0008` (engine dependency boundary), `ADR-0011` (reach the user's own agent)
- **Affected components**: `src/models/catalog.ts`, `src/models/gatewayCatalog.ts`, `src/services/gatewayCatalogService.ts`, `src/services/modelCatalogService.ts`, `src/services/llmErrors.ts`, `package.json`

## Context

The Vercel AI Gateway offers one API key reaching many upstream providers, with
failover and usage reporting. Adding it was on the modernization plan, and it
turned out to be nearly free: `createGateway` is a live export of the `ai`
package this extension already depends on, and `@ai-sdk/gateway` already ships
inside the VSIX as a transitive dependency. No new dependency, and — contrary to
the plan's assumption — no AI SDK v7 upgrade, which `ADR-0005` defers.

The question was therefore not whether it could be added but how prominently.
The gateway routes prompts through a third party. For this extension those
prompts can carry the specification: the requirements, the rationale, the
architecture. That is often the most sensitive text in a repository.

Two constraints already in force shape the answer. `ADR-0005` froze the bespoke
agent, so this serves a surface that receives no feature work. And the extension
markets itself as working offline with no account — a claim that must stay true.

## Decision drivers

- A user should choose to send their specification to a third party, not
  discover they have.
- The gateway must not become load-bearing for anything the extension promises
  works offline.
- The catalogue is large (206 text models across 28 vendors at the time of
  writing) and changes without this extension shipping, so it cannot be
  hard-coded.
- Effort spent here is effort not spent on the oversight surface; the smallest
  correct version is the right one.

## Options considered

1. **Make the gateway the default route.** Rejected. It would put a mandatory
   third-party hop in front of every user's specification, and contradict the
   offline claim for a benefit only some users want.
2. **Offer it first in onboarding.** Rejected for the same reason in weaker
   form: prominence is a recommendation, and recommending that specifications
   transit Vercel is not this project's call to make for its users.
3. **One provider entry among ten, chosen deliberately.** Chosen.

## Decision

The gateway is **one provider entry, listed last, never a default**. It is
configured exactly as the nine direct providers are — a key in SecretStorage or
an environment variable — and appears in the model picker only once configured.
A user who never selects it is unaffected in every respect.

**It is absent from every deterministic path.** `REQ-EXP-013` requires exports
to render from `@rqml/core` with no model and no network, and `REQ-GATE-002`
forbids a language model anywhere in the verdict. Both remain true: the gateway
can only ever serve the agent panel, which `ADR-0005` froze.

**The provider model gains a `kind` discriminator.** The gateway is constructed
differently from a direct provider — `createGateway` from `ai` rather than an
`@ai-sdk/*` factory, and namespaced model ids — so it branches explicitly rather
than being forced through the direct path. No `baseURL` is passed: the SDK's
default has moved between major versions, and hard-coding one would pin the
extension to whichever version happened to be installed.

**The catalogue is fetched, curated and cached.** It comes from the gateway's
public model list, which needs no API key — worth stating because the SDK's own
`getAvailableModels()` throws without one, so it cannot populate a picker for
someone who has not signed up. The list is filtered to text-capable models,
sorted deterministically so the picker does not reshuffle between openings, and
cached for a day. A failed fetch serves the stale list rather than an empty one:
the user asked to pick a model, not to hear about a service.

**Gateway failures are reported as gateway failures.** Its errors describe two
systems — the gateway and the upstream provider — and the remedies differ. A
spent credit balance and a bad key are both "HTTP 402" to the generic handler,
so the error formatter now names each case and what to do about it.

**No zero-data-retention toggle.** The SDK exposes `zeroDataRetention`, but the
guarantee behind it is plan-gated server-side, and the gateway does not route by
provider retention policy by default. A switch the extension cannot verify
honours itself would be a privacy assurance it has no standing to give. The
consideration is documented for users instead.

## Consequences

**Positive**
- Users who want one key for many models can have it, at the cost of one
  deliberate choice.
- Nothing about the offline or no-account claims changes for anyone else.
- The catalogue stays current without the extension shipping.

**Negative**
- Selecting the gateway sends specification content to a third party. The
  extension can document this but cannot mitigate it.
- The fetched catalogue means the picker's contents depend on a service that can
  change or disappear; the cache narrows that window rather than closing it.
- The gateway's usable model list is derived from a payload shape this project
  does not control. Parsing is defensive, so a shape change degrades to fewer
  models rather than an error — which is safer but also quieter.
- This deepens investment in the frozen agent, marginally. It is justified only
  because the cost was small; the same reasoning would not justify more.

## Supersession

None. This ADR is current. If the gateway is ever proposed as a default, or for
any deterministic path, that is a supersession and should be argued as one.
