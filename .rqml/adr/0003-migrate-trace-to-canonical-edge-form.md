# ADR-0003: Migrate trace links to the canonical nested `<edge>` form

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `required_by_spec`
- **Related requirements**: `REQ-UI-006J`, `REQ-UI-013`
- **Related ADRs**: `ADR-0001` (delegate to rqml-core), rqml-core `ADR-0003` (typed model is `2.1.0`-shaped), rqml-core `ADR-0004` (referential integrity)
- **Affected components**: `rqml-vscode.rqml`, `src/services/rqmlParser.ts`, `src/transformers/rqmlToMatrix.ts`, `src/transformers/rqmlToReactFlow.ts`

## Context

RQML has two trace serializations. The flat `2.0.1` form,
`<traceEdge from="A" to="B" type="...">`, carries endpoints as id attributes.
The canonical `2.1.0` form uses nested `<edge>` elements with structured
endpoints — `<edge><from><locator><local id="A"/></locator></from>…</edge>` —
which can locate not only local ids but also `doc` and `external` targets. The
extension and its example/spec document need one consistent form, and the
modeling in rqml-core (`ADR-0003`) types trace from the nested `<edge>` form,
so the flat form does not populate the typed `trace` model.

## Decision drivers

- Align with the canonical `2.1.0` schema the extension targets.
- Support structured endpoints (`local`/`doc`/`external`), which the flat
  attribute form cannot express.
- Stay compatible with rqml-core's typed model, which reads nested `<edge>`.

## Options considered

1. **Keep the flat `<traceEdge>` form.** Less churn, but locks the extension to
   the older serialization, cannot express non-local endpoints, and produces an
   empty typed `trace` model in rqml-core. Rejected.
2. **Support both forms in the extension.** Maximum tolerance, but doubles the
   trace-handling code and invites inconsistency between authored documents.
   Rejected for the extension's own document and parser.
3. **Migrate to the canonical nested `<edge>` form.** Convert the extension's
   document and parse/transform paths to nested `<edge>` with structured
   endpoints. Chosen.

## Decision

The extension's RQML document (`rqml-vscode.rqml`) and trace-handling code use
the canonical nested `<edge>` form exclusively. `rqmlParser.extractTraceEdges`
reads `trace/edge` and resolves each endpoint through
`edge/from|to/locator/{local|doc|external}`; the matrix and graph transformers
consume that structured shape. Referential integrity for trace endpoints is
delegated to rqml-core's `checkIntegrity`, which still understands both the
nested `2.1.0` and flat `2.0.1` forms so that ingesting third-party `2.0.1`
documents is not broken by this migration (rqml-core `ADR-0004`).

## Consequences

**Positive**
- The extension is aligned with the canonical `2.1.0` schema and rqml-core's
  typed model.
- Structured endpoints (`local`/`doc`/`external`) are expressible.
- One trace form in the extension's own document and code, removing dual-form
  branching there.

**Negative**
- The nested form is more verbose than flat attributes.
- The extension's authored document is now `2.1.0`-specific; reading older
  `2.0.1` documents relies on rqml-core (parse round-trip and `checkIntegrity`),
  not on the extension's own trace model.

## Supersession

None. This ADR is current.
