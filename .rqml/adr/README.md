# Architecture Decision Records

This directory captures the major architecture and design decisions for the
`rqml-vscode` extension. Each ADR is short, immutable once accepted, and follows
the RQML development-process design format
(https://www.rqml.dev/vscode/docs/development-process/design): a metadata block
(Status, Date, Classification, Related requirements, Related ADRs, Affected
components) followed by Context, Decision drivers, Options considered, Decision,
Consequences, and Supersession.

When a decision is revisited, do not edit the existing ADR — write a new one
that supersedes it, and mark the older one `Superseded by ADR-NNNN`.

## Index

| # | Title | Classification | Status |
|---|-------|----------------|--------|
| [0001](0001-delegate-engine-to-rqml-core.md) | Delegate parsing, validation, and integrity to rqml-core | discretionary_design_choice | Accepted |
| [0002](0002-esm-cjs-boundary-in-one-bridge-module.md) | Cross the ESM/CJS boundary in a single bridge module | implementation_detail | Accepted |
| [0003](0003-migrate-trace-to-canonical-edge-form.md) | Migrate trace links to the canonical nested `<edge>` form | required_by_spec | Superseded by [0010](0010-adopt-2.2.0-compact-trace-edges.md) |
| [0004](0004-full-delegation-and-outline-export.md) | Full delegation — drop fast-xml-parser and export from the core outline | discretionary_design_choice | Accepted |
| [0005](0005-oversight-surface-and-agent-freeze.md) | The extension is an oversight surface; the bespoke agent is frozen | discretionary_design_choice | Accepted |
| [0006](0006-enforcement-boundary-in-the-editor.md) | What the editor can enforce, and what it must only report | required_by_spec | Accepted |
| [0007](0007-nearest-enclosing-spec-discovery.md) | Resolve the governing spec by nearest enclosing directory, on Node | required_by_spec | Accepted |
| [0008](0008-engine-dependency-boundary.md) | Depend on the engine as a library; never shell out to the CLI | discretionary_design_choice | Accepted |
| [0009](0009-retire-subscription-and-backend-api.md) | Retire the subscription tiers and the external backend API | required_by_spec | Accepted |
| [0010](0010-adopt-2.2.0-compact-trace-edges.md) | Adopt the RQML 2.2.0 compact trace-edge form | required_by_spec | Accepted |

## A note on "rqml-core"

ADRs 0001, 0002 and 0003 were written when the engine was a standalone project
called **`rqml-core`**, and they name it that throughout — including ADR-0002,
which quotes the import specifier `"rqml-core"` in its decision text.

**That project no longer exists as a shipping dependency.** It was superseded by
the workspace packages in the [`rqml`](https://github.com/rqml-org/rqml)
monorepo, which are what the extension actually depends on:

| Then | Now |
|---|---|
| `rqml-core` (standalone repo, never published to npm) | [`@rqml/core`](https://www.npmjs.com/package/@rqml/core) |
| schemas bundled inside the engine | [`@rqml/schema`](https://www.npmjs.com/package/@rqml/schema), a dependency of `@rqml/core` |
| — | [`@rqml/cli`](https://www.npmjs.com/package/@rqml/cli), [`@rqml/mcp`](https://www.npmjs.com/package/@rqml/mcp) |

Read every `rqml-core` in ADRs 0001–0003 as `@rqml/core`. The *decisions* those
records describe — delegate the engine, cross the ESM/CJS boundary in one bridge
module, use the canonical `<edge>` form — all still stand; only the package name
and its home changed. The ADR bodies are left as written rather than edited,
since the decisions were not revisited. Their references to "rqml-core `ADR-000n`"
point at decision records that now live in the `rqml` monorepo.

## Cross-reference

The `requirements.rqml` document holds the agent-readable requirements these
decisions serve (e.g. `REQ-UI-013` semantic diagnostics); this directory holds
the long-form decision context.
