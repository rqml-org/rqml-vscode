# ADR-0002: Cross the ESM/CJS boundary in a single bridge module

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `implementation_detail`
- **Related requirements**: `REQ-UI-013`, `REQ-UI-013B`
- **Related ADRs**: `ADR-0001` (delegate to rqml-core), rqml-core `ADR-0002` (lazy validation entry)
- **Affected components**: `src/services/core.ts`, `tsconfig.json`

## Context

rqml-core is ESM-only (`REQ-ESM`), but the VS Code extension host compiles to
CommonJS (`tsconfig` `module: Node16`). A CommonJS module cannot statically
`import` an ESM-only package: a generated `require()` of an ESM-only package
throws `ERR_REQUIRE_ESM` at runtime. The extension must consume rqml-core's
runtime values and its TypeScript types without breaking under CommonJS, and
without every consuming file having to know about the boundary.

## Decision drivers

- The interop mechanics must live in exactly one place so the rest of the
  extension imports rqml-core normally.
- The libxml2 WASM runtime (loaded by rqml-core's `./validate` entry) must
  initialize at most once and only when validation actually runs.
- Type information from rqml-core must remain available at compile time even
  though emit is CommonJS.

## Options considered

1. **Static `import` from `"rqml-core"` in each file.** Simplest source, but
   emits `require()` of an ESM-only package and throws at runtime. Rejected.
2. **Switch the whole extension to ESM.** Removes the mismatch, but the VS Code
   extension host and its toolchain target CommonJS; a wholesale module-system
   change is high-risk and out of scope. Rejected.
3. **One bridge module that owns the boundary.** Pull runtime values via dynamic
   `import()` (which Node16 preserves as a real ESM import), and reference types
   through type-only imports carrying `resolution-mode: "import"`. Every other
   file imports rqml-core through this bridge. Chosen.

## Decision

`src/services/core.ts` is the single seam:

- Runtime values load via cached dynamic `import()` — `loadCore()` for the
  WASM-free entry and `loadValidate()` for the validation entry — so each module,
  and the WASM runtime, loads at most once and validation's WASM cost is paid
  only on demand (rqml-core `ADR-0002`).
- Types are re-exported from type-only imports written as
  `import type * as RqmlCore from "rqml-core" with { "resolution-mode": "import" }`,
  which lets Node16 resolve rqml-core's ESM `exports` for typing while emitting
  no `require()`.
- All other extension files import rqml-core types and loaders from this module,
  never from `"rqml-core"` directly.

`tsconfig.json` includes `"DOM"` in `lib` so the type surface rqml-core touches
(e.g. DOM-shaped types reachable through the model) resolves under the extension
compile.

## Consequences

**Positive**
- The ESM/CJS boundary is isolated to one module; the rest of the extension is
  unaware of it.
- WASM initializes lazily and once, preserving rqml-core's lazy-validation
  benefit inside the extension.
- Full rqml-core typing is available despite CommonJS emit.

**Negative**
- rqml-core access is asynchronous (`await loadCore()`), so call sites are async
  even for otherwise synchronous-looking operations.
- The `resolution-mode` import attribute is a relatively obscure feature; a
  contributor unfamiliar with it might "simplify" it back into a broken static
  import. The bridge module's header comment documents why it must stay.

## Supersession

None. This ADR is current. It would be revisited if the extension migrates to
ESM.
