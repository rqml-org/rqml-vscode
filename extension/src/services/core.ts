/**
 * Bridge to the canonical RQML engine packages: @rqml/core and @rqml/schema.
 *
 * @rqml/schema is a direct dependency rather than a transitive one. It arrives
 * transitively through @rqml/core either way, but @rqml/core's `./validate`
 * entry exports only `{ validate, supportedSchemaVersions }` — it does not
 * re-export the schema catalogue — so anything that needs the XSD text itself,
 * a namespace, or the set of known versions must import @rqml/schema directly.
 * Importing an undeclared transitive package would work only by npm hoisting,
 * which is not a contract.
 *
 * Both packages are ESM-only, but the extension host compiles to CommonJS
 * (tsconfig `module: Node16`). A CommonJS module cannot statically `import`
 * an ESM-only package, so:
 *
 *  - runtime values are pulled in via dynamic `import()` (which Node16
 *    preserves as a real ESM import), cached so each module — and, for
 *    validation, the libxml2 WASM runtime — loads at most once;
 *  - types are referenced through type-only imports carrying the
 *    `resolution-mode: "import"` attribute, which tells Node16 to resolve
 *    @rqml/core's ESM `exports` even though this file emits to CommonJS. The
 *    imports are erased at compile time, so no `require()` is generated.
 *
 * Other extension files should import these types from THIS module, not from
 * "@rqml/core" or "@rqml/schema" directly, so the ESM/CJS boundary stays in
 * one place.
 */

import type * as RqmlCore from "@rqml/core" with { "resolution-mode": "import" };
import type * as RqmlSchema from "@rqml/schema" with { "resolution-mode": "import" };

export type RqmlDocument = RqmlCore.RqmlDocument;
export type Requirement = RqmlCore.Requirement;
export type RequirementPackage = RqmlCore.RequirementPackage;
export type TraceEdge = RqmlCore.TraceEdge;
export type Locator = RqmlCore.Locator;
export type Criterion = RqmlCore.Criterion;
export type Meta = RqmlCore.Meta;
export type Author = RqmlCore.Author;
export type Diagnostic = RqmlCore.Diagnostic;
export type ParseResult = RqmlCore.ParseResult;
export type ValidationResult = RqmlCore.ValidationResult;
export type DocumentOutline = RqmlCore.DocumentOutline;
export type OutlineNode = RqmlCore.OutlineNode;
export type MarkdownOptions = RqmlCore.MarkdownOptions;

// Gate surface (REQ-GATE-001). Widened deliberately rather than wholesale: each
// of these has a consumer, so an unused re-export here means something was
// removed and this list was not updated.
export type CoverageReport = RqmlCore.CoverageReport;
export type DriftFinding = RqmlCore.DriftFinding;
export type DriftReport = RqmlCore.DriftReport;
export type DriftBaseline = RqmlCore.DriftBaseline;
export type ImplementsLink = RqmlCore.ImplementsLink;
export type PrematureImplementation = RqmlCore.PrematureImplementation;
export type GateVerdict = RqmlCore.GateVerdict;
export type GateFinding = RqmlCore.GateFinding;

// Export surface (REQ-EXP-013).
export type MatrixReport = RqmlCore.MatrixReport;
export type MatrixRow = RqmlCore.MatrixRow;
export type MatrixSummary = RqmlCore.MatrixSummary;
export type OutlineField = RqmlCore.OutlineField;
export type ResolvedEdge = RqmlCore.ResolvedEdge;

/** A schema version with a bundled XSD — currently "2.0.1" | "2.1.0" | "2.2.0". */
export type SchemaVersion = RqmlSchema.SchemaVersion;

type CoreModule = typeof import("@rqml/core", { with: { "resolution-mode": "import" } });
type ValidateModule = typeof import("@rqml/core/validate", { with: { "resolution-mode": "import" } });
type SchemaModule = typeof import("@rqml/schema", { with: { "resolution-mode": "import" } });

let corePromise: Promise<CoreModule> | undefined;
let validatePromise: Promise<ValidateModule> | undefined;
let schemaPromise: Promise<SchemaModule> | undefined;

/** Load the WASM-free core entry (parse, serialize, model, lint, trace). */
export function loadCore(): Promise<CoreModule> {
  return (corePromise ??= import("@rqml/core"));
}

/**
 * Load the XSD validation entry. Importing this initializes the libxml2 WASM
 * runtime, so it is kept separate and only paid for when validation runs.
 */
export function loadValidate(): Promise<ValidateModule> {
  return (validatePromise ??= import("@rqml/core/validate"));
}

/**
 * Load the schema catalogue: the bundled XSD text for each supported RQML
 * version, plus the namespace and schemaLocation URLs that go with it.
 *
 * This replaces the extension's former `resources/xsd/` directory and
 * `xsdVersions.ts`. Shipping our own copies meant the editor could recognise a
 * different set of schema versions than the engine validating against them —
 * which is exactly how the extension ended up unable to open a 2.2.0 document
 * while the CLI handled it fine.
 */
export function loadSchema(): Promise<SchemaModule> {
  return (schemaPromise ??= import("@rqml/schema"));
}
