# ADR-0008: Depend on the engine as a library; never shell out to the CLI

- **Status**: Accepted
- **Date**: 2026-07-23
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-UI-013`, `REQ-UI-013B`, `REQ-GATE-001`, `REQ-GATE-002`
- **Related ADRs**: `ADR-0001` (delegate the engine), `ADR-0002` (ESM/CJS boundary), `ADR-0006` (enforcement boundary)
- **Affected components**: `src/services/core.ts`, `package.json`

## Context

The RQML engine is published as four packages: `@rqml/core` (the library),
`@rqml/schema` (the XSD catalogue), `@rqml/cli` (a binary) and `@rqml/mcp` (an
MCP server). The extension needs the engine for validation, integrity,
coverage, drift and — under `ADR-0006` — the verdict. Three ways to obtain it
were available, and the choice had not been recorded.

The immediate reason to record it now is that the engine upgrade exposed how
the packages actually relate. `@rqml/core` depends on `@rqml/schema` but its
`./validate` entry re-exports only `{ validate, supportedSchemaVersions }` —
not the schema catalogue. So a consumer needing the XSD text, a namespace or
the set of known versions must depend on `@rqml/schema` directly; reaching it
as an undeclared transitive dependency works only through npm's hoisting
layout, which is not a contract. Meanwhile `@rqml/cli` and `@rqml/mcp` expose
only a `bin` and their `package.json` — neither offers a library API.

## Decision drivers

- The verdict must be deterministic and available with no network and no model
  (`REQ-GATE-002`), which rules out anything that depends on a subprocess being
  installed.
- A subprocess per keystroke-adjacent validation is not viable; the in-process
  full pass over this repository's 202 KB specification measures around 11 ms.
- Version skew between the editor's engine and the user's globally installed
  CLI would produce exactly the disagreement `ADR-0006` forbids.

## Options considered

1. **Spawn `@rqml/cli` and parse its JSON output.** Guarantees byte-identical
   behaviour with the command line, but requires Node and the package to be
   present on the user's machine, adds process latency to every validation, and
   makes the extension's correctness depend on which version happens to be
   installed. Rejected.
2. **Embed `@rqml/mcp` and speak JSON-RPC to it.** Its thirteen tools are
   one-to-one wrappers over `@rqml/core` functions the extension can call
   directly, so this means running a subprocess to talk to a library already in
   process. Rejected.
3. **Depend on `@rqml/core` and `@rqml/schema` as libraries.** Chosen.

## Decision

The extension depends on **`@rqml/core` and `@rqml/schema` as direct
dependencies**, both loaded in process through the single bridge module
established by `ADR-0002`. `@rqml/schema` is direct rather than transitive for
the reason above: the catalogue is not reachable through `@rqml/core`'s public
entries, and depending on hoisting is not a dependency declaration.

The extension does **not** spawn `@rqml/cli` and does **not** embed
`@rqml/mcp`. Where a user wants the CLI's behaviour — in a task, a pre-commit
hook, or CI — the extension points at the command rather than wrapping it.

Registering `@rqml/mcp` so that *other* agents can call the same engine is a
different thing, and remains open as a future integration: it gives another
agent the tools, rather than giving this extension a redundant transport to a
library it already holds.

Dependency ranges on these two packages are treated as a compatibility
statement, not a formality. The `^0.1.0` range that preceded this decision
resolved below `0.2.0` by construction, so eight minor versions of engine work
accumulated behind a pin that npm would never move, and the editor silently
lost the ability to open a document the CLI handled fine. Ranges must be
reviewed whenever the engine publishes a minor.

## Consequences

**Positive**
- The verdict is available offline, with no model, and with no dependency on
  anything installed outside the extension.
- No process-spawn latency, so validation can run on document change.
- The engine version is pinned by the extension's own manifest, so the editor
  and its bundled engine ship and are tested together.

**Negative**
- Engine upgrades are the extension's responsibility and arrive only when it
  publishes; a user with a newer CLI can see the CLI accept a document the
  installed extension does not yet understand. This is the failure this ADR was
  written after, and only diligence about ranges prevents it recurring.
- Both packages are ESM-only, so every access stays asynchronous behind the
  `ADR-0002` bridge.
- The engine and its libxml2 WASM runtime ship inside the VSIX, which is a
  meaningful share of the install size.

## Supersession

None. This ADR is current.
