/**
 * Bridge to @rqml/core, the canonical RQML engine.
 *
 * @rqml/core is ESM-only, but the extension host compiles to CommonJS
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
 * Other extension files should import @rqml/core types from THIS module, not
 * from "@rqml/core" directly, so the ESM/CJS boundary stays in one place.
 */

import type * as RqmlCore from "@rqml/core" with { "resolution-mode": "import" };

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

type CoreModule = typeof import("@rqml/core", { with: { "resolution-mode": "import" } });
type ValidateModule = typeof import("@rqml/core/validate", { with: { "resolution-mode": "import" } });

let corePromise: Promise<CoreModule> | undefined;
let validatePromise: Promise<ValidateModule> | undefined;

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
