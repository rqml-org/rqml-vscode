# ADR-0009: Retire the subscription tiers and the external backend API

- **Status**: Accepted
- **Date**: 2026-07-23
- **Classification**: `required_by_spec`
- **Related requirements**: `PKG-AUTH` (`REQ-AUTH-001`..`006`, `REQ-SUB-001`..`004`), `PKG-API` (`REQ-API-001`..`005`), `REQ-EXP-013`
- **Related ADRs**: `ADR-0005` (oversight surface)
- **Affected components**: `requirements.rqml`, `src/export/exportService.ts`

## Context

The specification carried two packages describing a commercial architecture
that the portfolio has since decided against: `PKG-AUTH`, with GitHub login,
three subscription tiers and feature gating by tier; and `PKG-API`, with a
backend service at a third domain, authenticated requests to it, and an offline
mode for the subset of features deemed free. Fifteen requirements in total, all
at `draft`, none implemented beyond a pro-tier gate on export.

The organisation's strategy specification now states that single-specification
export is free by principle, and names this extension's pro-tier export
placement as something that must be revisited to match. The published
positioning says the same in plainer words: no server, no dashboard, no
account. So the specification asserted a product shape the organisation had
already rejected.

Leaving them as `draft` was not neutral. A draft requirement reads as intent —
work not yet done rather than work decided against — so anyone reading the
specification, human or agent, would reasonably plan toward building it.

## Decision drivers

- The specification is the source of truth for intent; intent that has been
  abandoned must say so.
- Deleting fifteen requirements erases the record that they were ever
  considered and why they were dropped, in a repository whose whole subject is
  keeping that kind of record.
- `ADR-0005` scopes the extension to the oversight surface, and a licensing and
  entitlement system is neither that nor adjacent to it.

## Options considered

1. **Delete the packages.** Smallest specification, but destroys the history of
   a real product decision and leaves the trace edges that referenced them
   dangling.
2. **Leave them at `draft`.** Keeps the record but keeps signalling intent to
   build, which is the misreading that prompted this ADR.
3. **Transition them to `deprecated` and record the reasoning here.** Chosen.

## Decision

All fifteen requirements in `PKG-AUTH` and `PKG-API` move to
`status="deprecated"`. The elements, their acceptance criteria and the trace
edges that reference them remain in the document: `deprecated` is the
vocabulary's term for intent that was real and is no longer pursued, and
retaining the edges keeps the graph intact.

The pro-tier gate on export is removed from the implementation. Export is free,
and `REQ-EXP-013` now requires it to be reproducible offline with no model
configured — the opposite commitment from a paid, service-backed feature.

Nothing here forecloses a future commercial offering. It records that if one
exists, it will not take the form of authentication, tiers and feature gating
inside this extension.

## Consequences

**Positive**
- The specification stops describing a product the organisation decided not to
  build, so readers and agents stop planning toward it.
- The reasoning survives in a form a later reader can evaluate, rather than
  vanishing in a deletion.
- Coverage and lint figures stop counting abandoned work as outstanding.

**Negative**
- Twenty deprecated requirements are noise in the document for any reader who
  does not know why they are there; this ADR is the only thing that explains
  them, and it has to be found.
- Trace edges still reference deprecated requirements, so the graph carries
  paths into a retired area.
- If a commercial offering is ever revisited, it starts from a deprecated
  record rather than a live draft, and will want a fresh set of requirements
  informed by whatever the shape turns out to be.

## Supersession

None. This ADR is current.
