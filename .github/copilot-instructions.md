# Copilot instructions — rqml-vscode

This repository is governed by an RQML specification. **Read [`AGENTS.md`](../AGENTS.md)
at the repository root first** — it holds the working agreement: the five-stage
process, the toolchain, the enforcement boundary, and the strictness level. This
file adds only what is specific to this codebase.

## The short version

- `requirements.rqml` is the source of truth for intent. Code follows it, not
  the reverse.
- Do not implement behaviour that is not specified. Add the requirement first.
- `npx @rqml/cli check` must exit 0 before any task is finished.
- Record significant architectural decisions as ADRs in `.rqml/adr/`. ADRs are
  immutable once accepted — supersede, never edit.

## Repository layout

| Path | What it is |
|---|---|
| `requirements.rqml` | The governing specification (RQML 2.2.0) |
| `.rqml/adr/` | Architecture Decision Records, indexed in `README.md` |
| `.rqml/baseline.json` | Drift baseline. Never edit by hand — `rqml link --refresh` records it |
| `extension/src/` | Extension host code; CommonJS, runs on Node |
| `extension/webview-ui/src/` | React sources for the webviews; a build input only |
| `extension/out/` | `tsc` output — the published entry point (`main`) |
| `extension/dist/` | esbuild output — the webview bundles |
| `docs/` | The Docusaurus site published at rqml.dev/vscode |

## Things that will trip you up

**There are two builds.** `tsc` produces `extension/out/`; esbuild produces
`extension/dist/`. A webview change needs `npm run build:webview`; an extension
host change needs `npm run compile`. `compile` cleans `out/` first, because
stale output from deleted sources was previously being packaged and shipped.

**The ESM/CJS boundary.** `@rqml/core` and `@rqml/schema` are ESM-only while the
extension host emits CommonJS. All access goes through
`extension/src/services/core.ts`, which uses dynamic `import()` and
`resolution-mode` type imports. Do not import either package anywhere else —
see ADR-0002 and ADR-0008.

**Provider SDKs load from a static map.** `extension/src/models/providerModules.ts`
maps each provider id to a literal `import()`. A computed specifier is invisible
to packaging tools, which is how five providers once shipped broken in every
real install. Add providers there; never assemble the specifier from a string.

**The scope filter.** ADR-0005 froze the built-in agent: it gets correctness and
security fixes, not features. Before adding anything, ask whether the capability
requires a configured model to be useful. If it does, it is out of scope. Editor
primitives — the tree, deterministic export, code actions — are not agent
features and remain in scope.

**Terminology.** When describing specification scope or discovery, write
"parent directory", "subdirectory", and "nearest enclosing spec". Do not use
tree metaphors: no walking up or down, no root, no leaves. A specification
governs its own directory and every subdirectory of it, never a parent
directory.

**Do not hand-edit trace XML.** Use `rqml link` to record an edge and
`rqml link --refresh <edge-id>` to re-record a baseline after an intentional
change.

## Before you finish

```bash
npx @rqml/cli check
npm --prefix extension run compile
npm --prefix extension run lint
```
