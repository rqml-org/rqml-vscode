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
| [0003](0003-migrate-trace-to-canonical-edge-form.md) | Migrate trace links to the canonical nested `<edge>` form | required_by_spec | Accepted |
| [0004](0004-full-delegation-and-outline-export.md) | Full delegation — drop fast-xml-parser and export from the core outline | discretionary_design_choice | Accepted |

## Cross-reference

These ADRs frequently reference `rqml-core`'s own decision records (in
`rqml-core/.rqml/adr/`), since the extension delegates its engine to rqml-core.
The `rqml-vscode.rqml` requirements document holds the agent-readable
requirements these decisions serve (e.g. `REQ-UI-013` semantic diagnostics);
this directory holds the long-form decision context.
