# ADR-0005: The extension is an oversight surface; the bespoke agent is frozen

- **Status**: Accepted
- **Date**: 2026-07-23
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `PKG-AGENT` (`REQ-AGT-001`..`REQ-AGT-032`), `PKG-CMD`, `PKG-MODEL`, `PKG-MATRIX`, `PKG-EXPORT`
- **Related ADRs**: `ADR-0001` (delegate engine to rqml-core), `ADR-0002` (ESM/CJS boundary)
- **Affected components**: `package.json` (contributed settings), `src/services/agentService.ts`, `src/services/llmService.ts`, `src/services/modelCatalogService.ts`, `src/services/implementTools.ts`, `src/webviews/AgentViewProvider.ts`, `webview-ui/src/agent/`

## Context

The extension was built around a bespoke chat agent: its own LLM provider stack,
its own model catalog, its own tool loop, its own diff and plan UI. That agent is
roughly 38–48% of the codebase and competes directly with GitHub Copilot, Claude
Code and Cursor — products with vastly greater investment behind them.

Meanwhile the portfolio has settled its positioning elsewhere. The shipped
landing copy states the division explicitly ("Plugins enforce; these assist"),
and the org strategy specification (`RQML-STRATEGY-001`) places rqml-vscode in
**zero** H1 cascade edges and only two low-confidence H2 edges — both of them
about the *audit-facing* surface (`E-CASC-H2-COMM`, stakeholder communication,
confidence 0.7; `E-CASC-H2-MATRIX`, the traceability matrix, confidence 0.6).
Nothing in the strategy depends on the extension having an agent.

At the same time the extension's *engine* integration has fallen behind. Only
five symbols cross the `ADR-0002` bridge (`parse`, `checkIntegrity`,
`buildOutline`, `outlineToMarkdown`, `validate`), while every verdict the product
renders — `/lint`, `/status`, `/sync`, `/diff`, `/score` — is produced by an LLM
prompt rather than by the canonical engine. So the surface most aligned with the
strategy is the one receiving the least investment, and the editor can disagree
with the CLI and CI about whether a document is sound.

Without a recorded scope decision, every subsequent workstream re-litigates the
same question: does this change serve the agent or the oversight surface?

## Decision drivers

- The strategy needs one thing from this extension: an editor view of the same
  deterministic verdict the CLI and CI produce. Nothing else it does is
  load-bearing portfolio-wide.
- A verdict produced by a language model cannot be the same verdict as one
  produced by `@rqml/core`. Two engines means the editor can contradict the
  build, which is the one failure the product exists to prevent.
- Deleting the agent is premature: it works, it is the only path for users
  without a Copilot subscription, and removing it is irreversible.
- Effort spent on the agent is effort not spent on the engine integration, and
  the agent's competitive position is not winnable by a solo maintainer.
- Platform direction reinforces the same conclusion: VS Code is narrowing
  extension participation in AI toward contributed tools, MCP servers and
  agents, which makes a bespoke in-extension chat loop increasingly off-platform.

## Options considered

1. **Grow the agent as a first-class feature** alongside enforcement — keep
   investing in the LLM stack, upgrade the AI SDK, expand the tool loop.
   Rejected: it doubles down on the least strategically relevant ~40% of the
   codebase, against far better-resourced competitors.
2. **Delete the agent outright** and ship an enforcement-and-visualisation
   extension. Rejected as premature and irreversible: it strands users without
   a Copilot subscription and discards working code before any evidence that
   removing it is correct.
3. **Freeze the agent behind a setting; invest in the oversight surface.** The
   agent keeps working and receives correctness and security fixes, but no
   feature work. Chosen.

## Decision

**The product statement.** rqml-vscode is where a human watches what an agent did
to a governed repository — the same deterministic verdict the CLI and CI produce,
rendered in the editor.

**The freeze.** The bespoke agent is placed behind a contributed setting,
`rqml.agent.enabled`. It continues to function and remains eligible for
correctness, security and dependency-hygiene fixes. It receives no feature work.

**The scoping rule this ADR establishes.** A change that *adds agent
capability* is out of scope. A change that makes the editor render the canonical
engine's verdict, or that repairs a shipped defect, is in scope. Editor
primitives reachable without a language model — the tree's add/rename/delete
commands, deterministic export, code actions on diagnostics — are *not* agent
features and remain in scope; the distinguishing test is whether the capability
requires a configured model to be useful.

**Two consequences that follow immediately**, both of which cite the compile
spike recorded below rather than assumption:

- The `@rqml/core` `0.1.0` → `0.8.0` upgrade proceeds. It type-checks cleanly
  through the existing `ADR-0002` bridge, so the engine integration is not
  blocked on any build-system change.
- The AI SDK v6 → v7 upgrade is deferred. It is not blocked on bundling, but it
  targets the frozen surface, so it is maintenance to be taken when convenient
  rather than a funded workstream.

## Compile spike (2026-07-23)

Run in an isolated copy of `extension/` with Node 24.16.0 and TypeScript 5.9.3,
against the unmodified `tsconfig.json` (`module: Node16`, CommonJS emit).

| Configuration | `tsc -p ./ --noEmit` | Errors |
|---|---|---|
| Baseline — `@rqml/core@0.1.0`, `ai@6.0.77` | exit 0 | 0 |
| `@rqml/core@0.8.0` + `@rqml/schema@0.2.1` | exit 0 | 0 |
| `ai@7.0.35` + `@ai-sdk/*@4.0.x` | exit 2 | 10 |

The v7 failures are of two kinds, and the distinction matters because it
corrects the assumption that v7 requires bundling:

- **6 × TS1541/TS1542** — type-only imports of `ai` (`LanguageModel`,
  `ProviderMetadata`) in `exportService.ts`, `llmReportGenerator.ts`,
  `catalog.ts`, `agentService.ts`, `llmService.ts`, `modelCatalogService.ts`.
  Each is fixed by adding `with { "resolution-mode": "import" }` — the technique
  `ADR-0002` already established in `src/services/core.ts`.
- **4 × TS1479** — static ESM *value* imports of `ai` in
  `llmReportGenerator.ts` (`generateObject`), `agentService.ts` (`streamText`,
  `stepCountIs`), `implementTools.ts` (`tool`) and `llmErrors.ts` (the error
  classes used in `instanceof` checks). These require conversion to dynamic
  `import()`, which restructures the tool definitions and the streaming loop.

So v7 is reachable by extending the `ADR-0002` bridge to the `ai` package — a
bounded refactor of ten sites — and does **not** require host bundling or a
change to `tsconfig`'s `module` setting. It is deferred on scope grounds (it
serves the frozen agent), not on feasibility grounds.

Two further facts the spike established, both load-bearing for the engine work:

- `@rqml/core/validate` exports exactly `{ ValidateOptions,
  supportedSchemaVersions, validate }`. There is no `schemaFor` or
  `DEFAULT_SCHEMA_VERSION`, so schema text must come from `@rqml/schema`'s own
  entry — a direct dependency, not a transitive one.
- `@rqml/core@0.8.0`'s main entry already exports the whole enforcement surface
  in-process: `approvalGate`, `computeCoverage`, `detectDrift`, `loadBaseline`,
  `computeBaseline`, `saveBaseline`, `discoverSpecs`, `resolveGoverningSpec`,
  `impactOf`, `lint`, `lintAdrReferences`, `resolveTrace`, `buildMatrix`,
  `appendTraceEdge`, `updateTraceEdge`, `setStatus`, `skeleton`,
  `migrateDocument`. Note the last is named `migrateDocument`, not `migrate`.

## Consequences

**Positive**

- Every later workstream has a scoping test that does not require re-arguing
  product direction.
- Investment moves to the surface the strategy actually names, and the editor
  stops being able to contradict the build.
- The AI SDK v7 upgrade, the model-catalog maintenance and the provider matrix
  all become optional rather than blocking.
- The agent remains available for users without a Copilot subscription, so the
  freeze costs no existing user anything.

**Negative**

- The extension's most visually distinctive feature stops improving, and its
  marketplace copy — which currently leads with the agent — must be rewritten to
  match, or the listing will misrepresent the product.
- A frozen agent still carries maintenance: its dependencies remain in the
  supply chain and still need security fixes, so the freeze reduces feature cost
  but not hygiene cost.
- `rqml.agent.enabled` defaulting matters and is not settled by this ADR. If it
  defaults off, existing users lose a feature on upgrade; if on, the listing
  keeps promising the thing that is frozen.
- Should evidence later show real demand for the agent, reversing this decision
  means re-entering a competitive race from a position further behind.

## Supersession

None. This ADR is current. If the freeze is reversed, supersede it rather than
editing it, and re-open the AI SDK v7 question in the superseding record.
