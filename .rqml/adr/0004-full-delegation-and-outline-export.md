# ADR-0004: Full delegation — drop fast-xml-parser and export from the core outline

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-EXP-005`, `REQ-UI-005`, `REQ-UI-006A`, `REQ-UI-006J`
- **Related ADRs**: `ADR-0001` (delegate engine), `ADR-0002` (ESM/CJS boundary), rqml-core `ADR-0005`/`ADR-0007`
- **Affected components**: `src/services/rqmlParser.ts`, `src/transformers/matrixDerive.ts`, `src/export/exportService.ts`, `src/export/exportMarkdown.ts`, `src/export/promptBuilder.ts`, `package.json`

## Context

`ADR-0001` moved validation and integrity to rqml-core, but the extension still
parsed XML itself: `rqmlParser.ts` ran its own `fast-xml-parser` to build the
view model behind the tree/details/matrix views, and the export pipeline
flattened each item to six fields (`id, type, title, status, priority, section`)
before handing it to the LLM. So two things lagged the canonical engine: a second
XML parse path, and an export that — even after rqml-core grew the full model
(`ADR-0005`) and an outline serializer (`ADR-0007`) — could never show the LLM a
statement, acceptance criterion, goal, scenario, or test, because they were
dropped before the prompt was built.

## Decision drivers

- One parser, not two: the editor's structural view must come from the same
  engine that validates (`REQ-UI-013`, `ADR-0001`).
- Export quality and flexibility: the LLM should receive the document's real
  content, scoped to the user's section/item selection.
- Land the change without a big-bang rewrite of every view.

## Options considered

1. **Keep `fast-xml-parser` in the extension; enrich only the export.** Leaves
   the duplicate parse path and an XML stack to maintain. Rejected.
2. **Rewrite every view onto rqml-core's typed model at once.** Cleanest end
   state, but a large, risky change across ~10 consumers. Deferred as follow-up.
3. **Adapt at the seam.** Rewrite `rqmlParser.ts` to delegate to
   `loadCore().parse()` and adapt the typed model into the existing view shape,
   putting the typed core element on each `item.raw`; feed the export pipeline the
   core outline. Chosen.

## Decision

`rqmlParser.ts` no longer imports `fast-xml-parser`; `parseText` calls
`loadCore().parse()` and adapts the typed `RqmlDocument` into the legacy view
shape (sections `Map`, item tree, resolved `traceEdges`, `findLineNumber` for
go-to-definition). Each `RqmlItem.raw` is the typed core element — core uses
plain property names for both attributes and child text, so existing
`raw.statement`/`raw.definition` reads keep working; `matrixDerive.readAttribute`
drops its `@_` prefix accordingly. The export pipeline reads the rich model: the
view document carries the core document on `.raw`, from which `exportService`
builds `buildOutline()`, prunes it to the wizard's selection
(`exportMarkdown.scopeOutline`, mapping outline section titles back to RQML
section names and always retaining Trace), and renders `outlineToMarkdown()` into
`ExportData.content`. `serializeExportData` prefers that rich markdown over the
old flat list. `fast-xml-parser` is removed as a direct dependency; it remains in
`node_modules` only transitively, because rqml-core uses it internally.

## Consequences

**Positive**
- A single parse path; the editor's structural view is the canonical engine's,
  by construction.
- The LLM prompt now contains full statements, acceptance criteria, goals,
  scenarios, behavior, interfaces, verification, and a resolved trace table,
  scoped to the user's selection — a large export-quality jump.
- The format generators are unchanged; they still receive `ExportData` metadata.

**Negative**
- The export pipeline depends on the internal contract that the view document's
  `.raw` is the core document; a future view rewrite must preserve or replace it.
- `scopeOutline` maps outline section titles → RQML section names by a static
  table that must track rqml-core's outline section titles.
- The deeper migration of the tree/matrix/graph views onto native core types
  (beyond the `raw` adapter) is deferred.

## Supersession

None. This ADR is current.
