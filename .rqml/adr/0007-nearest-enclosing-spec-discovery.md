# ADR-0007: Resolve the governing spec by nearest enclosing directory, on Node

- **Status**: Accepted
- **Date**: 2026-07-23
- **Classification**: `required_by_spec`
- **Related requirements**: `REQ-UI-015`, `REQ-UI-016`, `REQ-UI-017`, `REQ-UI-018`
- **Related ADRs**: `ADR-0008` (engine dependency boundary)
- **Affected components**: `src/services/specService.ts`, `src/extension.ts`

## Context

The extension finds specifications with a `**/*.rqml` workspace glob and, when
that yields nothing useful, a bounded search of parent directories. Two
problems follow from that implementation.

The parent-directory search has no boundary. It runs a fixed number of
iterations with no stop at a repository root or workspace folder edge, so from
a file inside this repository it reaches the containing portfolio directory and
finds the organisation's strategy specification. That document governs the
portfolio, not this extension, and it can become the active specification for
an editor session — which means the verdict, the tree, and the agent would all
be operating against the wrong document.

Separately, the extension answers a different question from the rest of the
portfolio. The ecosystem rule is that a specification governs its own directory
and every subdirectory of it, never a parent directory; where one
specification's directory is itself a subdirectory of another's, the nearest
enclosing specification governs. Placement decides scope and nothing else —
information flows between specifications only through trace edges carrying
document locators, never by where files sit. `@rqml/core` implements exactly
this in `discoverSpecs` and `resolveGoverningSpec`. The extension reimplements
an approximation of it.

## Decision drivers

- The extension must resolve the same governing specification that the CLI,
  the MCP server and the agent plugins resolve for the same file. A different
  answer here means a different verdict, which `ADR-0006` forbids.
- A search that can escape the workspace is a correctness bug, not a tuning
  parameter.
- One discovery implementation, not two, for the same reason `ADR-0001` gave
  for one parser.

## Options considered

1. **Keep the local implementation and add a boundary check.** Fixes the
   immediate escape but leaves a second discovery algorithm that will drift
   from the canonical one, exactly as the second XML parser did.
2. **Delegate to `@rqml/core`'s `discoverSpecs` / `resolveGoverningSpec`.**
   One implementation, shared with every other surface. Chosen.

## Decision

Spec discovery and governing-spec resolution delegate to `@rqml/core`.
`discoverSpecs` enumerates the units in a workspace folder; `resolveGoverningSpec`
answers which specification governs a given file. The local
`searchParentDirectories`, `deduplicateUris` and `filterUnitSpecs` helpers and
the `**/*.rqml` glob are removed. The workspace folder is the boundary, per
`REQ-UI-018`; the search never crosses it.

Where a directory contains several candidate specifications, the ambiguity is
surfaced to the user rather than resolved silently — the current
`filterUnitSpecs` drops such directories, which makes a real configuration
problem invisible.

**The extension is Node-only.** `@rqml/core`'s discovery reads the filesystem
through `node:fs` synchronously, so adopting it makes a Node runtime a hard
requirement rather than an incidental one. The extension already reads files
directly and ships no browser entry point, so this changes nothing in practice;
it records as a decision what was previously an accident. The extension will
not run in `vscode.dev` or other browser-hosted VS Code environments.

## Consequences

**Positive**
- The extension can no longer adopt a specification from outside the workspace.
- Every RQML surface answers "which spec governs this file" identically.
- Ambiguous directories become a visible, fixable condition.

**Negative**
- Browser-hosted VS Code is ruled out. This forecloses `vscode.dev` and
  GitHub's web editor as deployment targets, which would otherwise be a
  plausible home for a read-only specification browser.
- Discovery becomes synchronous filesystem work on the extension host. It must
  be kept off frequent paths such as active-editor changes without caching
  (`REQ-UI-017`).
- The extension inherits `@rqml/core`'s discovery semantics, including its
  exclusion handling, and must feed it the user's `files.exclude` and
  `search.exclude` settings to behave as users expect.

## Supersession

None. This ADR is current.
