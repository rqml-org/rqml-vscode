# ADR-0001: Delegate parsing, validation, and integrity to rqml-core

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-UI-013`, `REQ-UI-013A`, `REQ-UI-013B`
- **Related ADRs**: `ADR-0002` (ESM/CJS boundary), rqml-core `ADR-0001`/`ADR-0002`/`ADR-0004`
- **Affected components**: `src/services/diagnosticsService.ts`, `src/services/core.ts`, `package.json`

## Context

The extension originally carried its own XML and validation stack: `xmllint-wasm`
for XSD validation and `@xmldom/xmldom` for DOM-based parsing, with hand-rolled
duplicate-id and broken-trace-ref checks layered on top. Meanwhile `rqml-core`
was established as the single, authoritative TypeScript/JavaScript engine for
RQML (`REQ-ISOMORPHIC`, `REQ-TYPED-API`). Maintaining a second, divergent
validation path in the extension meant the editor could disagree with the
canonical engine about whether a document is valid.

## Decision drivers

- Diagnostics shown in the editor must match what the canonical engine reports;
  one implementation, not two.
- `REQ-UI-013B` requires XSD schema validation; reusing rqml-core's bundled,
  version-dispatched schemas is strictly better than a second schema stack.
- Less bespoke XML code in the extension to maintain and keep in sync with the
  schema.

## Options considered

1. **Keep the extension's own validation stack.** No new dependency on a young
   library, but guarantees drift between the editor and the canonical engine and
   doubles the maintenance surface. Rejected.
2. **Delegate everything to rqml-core.** `parse()` for well-formedness and
   structure, `validate()` for version-dispatched XSD validation, and
   `checkIntegrity()` for duplicate ids and dangling trace references; remove the
   legacy XML dependencies. Chosen.

## Decision

`DiagnosticsService.validateDocument` calls rqml-core: `parse()` first (it never
throws and reports well-formedness/structural problems), then `validate()` for
canonical XSD validation, then `checkIntegrity()` for referential checks the XSD
identity constraints do not enforce (see rqml-core `ADR-0004`). The three result
sets are merged and mapped to `vscode.Diagnostic`s. The hand-rolled checks and
the `xmllint-wasm` and `@xmldom/xmldom` dependencies were removed; rqml-core
bundles its own schemas, so `loadSchema` is a no-op kept only for API
compatibility.

## Consequences

**Positive**
- Editor diagnostics match the canonical engine by construction — duplicate-id,
  dangling-trace-ref, and XSD results all come from one place.
- Multi-version validation (rqml-core `ADR-0001`) is inherited for free.
- Less bespoke XML/validation code to maintain in the extension.

**Negative**
- The extension now depends on rqml-core's release cadence and API stability.
- rqml-core is ESM-only while the extension host is CommonJS, which forces a
  module-interop seam (see `ADR-0002`).
- Referential integrity relies on rqml-core's `checkIntegrity` rather than the
  schema, so a gap there surfaces as a gap in the editor.

## Supersession

None. This ADR is current.
