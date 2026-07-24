# Changelog

All notable changes to the RQML for VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Per VS Code marketplace convention, odd MINOR versions (`1.1.x`) are pre-release and even MINOR versions (`1.2.x`, `1.4.x`, ...) are stable.

> **Release channel.** The extension ships on the *pre-release* channel by
> deliberate choice, and every version to date has carried an odd minor
> accordingly. It stays there until quality, presentation, and the value
> proposition are judged ready for a stable release; only then does an even
> minor (`1.2.0`) get published without `--pre-release`. Note the consequence
> while that holds: VS Code does not install pre-release builds by default, so
> Marketplace install counts measure opt-in users and are not a demand signal.

## [1.1.9] — 2026-07-24

The largest release so far. The extension can now read the RQML version the
toolchain actually produces, it renders the same verdict your build renders, and
it hands the whole toolchain to whichever coding agent you already use.

### Fixed — things that prevented the extension working

- **The extension could not open a current specification.** It was pinned to an
  engine eight minor versions old, behind a dependency range that could never
  advance, so a document produced by a current `rqml init` — schema 2.2.0 — could
  not be validated at all. It now reads and validates 2.2.0, 2.1.0 and 2.0.1, and
  creates new specifications at 2.2.0. Schema knowledge comes from the engine
  rather than from copies shipped alongside it, so the editor and the
  command-line tool can no longer disagree about what is valid.
- **Five of nine language-model providers failed in every real install.** xAI,
  Mistral, Groq, DeepSeek and Perplexity were declared in the wrong package, so
  selecting any of them threw `MODULE_NOT_FOUND`. A development checkout resolved
  them anyway, which is why it went unnoticed. All ten providers now work.
- **A specification could be destroyed by an agent edit.** The agent could write
  a whole new specification file with no validation at all — an empty response,
  prose, or a document truncated mid-element would replace your work, without
  entering the undo stack and without a backup. Every write is now checked
  first, and refused if it would introduce errors the document does not already
  have. An unparseable result is never written.
- **The extension could adopt a specification from outside your workspace.** The
  search for a governing specification had no boundary and could climb out of the
  repository entirely, offering an unrelated document as the active one. It now
  resolves the nearest enclosing specification and never crosses a workspace
  folder.
- **Trace views silently lost every link to code.** Non-local endpoints were
  discarded when building the view model, so `implements` edges — the links from
  requirements to source — rendered blank.
- **The agent panel could not activate on demand**, and the extension activated
  in every window rather than only where a `.rqml` file exists.

### Added

- **The gate.** A deterministic verdict for the active specification — schema,
  referential integrity, coverage and drift — in the status bar and the Problems
  panel. It is computed by the same engine as `rqml check`, composed the same
  way, so the editor and your build cannot disagree. It needs no model and no
  network. A drifted implementation offers a one-click re-pin, per edge, once you
  have reviewed the change.
- **Reproducible offline export.** Exports render from the engine, so the same
  specification produces the same document for any reviewer, later, with no model
  configured and no network. Previously every format required a language model,
  which meant no reproducible export existed at all.
- **Your own coding agent gets the toolchain.** The RQML MCP server is registered
  for you, so GitHub Copilot's agent mode — or anything speaking MCP — can call
  `rqml_check`, `rqml_show`, `rqml_impact`, `rqml_link` and nine more, scoped
  automatically to the specification governing your work. Two further tools cover
  what a separate process cannot see: which specification governs the open file,
  and the verdict for unsaved changes.
- **Optional approval gate on agent writes.** Off by default. When enabled, the
  built-in agent refuses to write code implementing a requirement that is not yet
  approved. The README states plainly what this does and does not cover: edits
  you make yourself, or that another agent makes, are reported and not blocked.
- **The Vercel AI Gateway** as one optional provider — one key reaching many
  models. Never a default, never selected for you, and absent from every path
  that works offline.
- **Working tree commands.** Add, rename and delete in the specification tree
  perform the edit instead of showing a "coming soon" message. Edits preserve
  your file's formatting and comments, and go through the same write guard.

### Changed

- **`/status`, `/validate`, `/lint`, `/sync`, `/trace` and `/diff` now report the
  engine's answer** rather than asking a language model. These commands answer
  checkable questions, and a model's answer could — and did — contradict the
  gate: `/sync` counted any trace edge as coverage and reported far fewer gaps
  than actually existed. Model commentary is still available with `--full`,
  alongside the real figures rather than instead of them.
- **Install size reduced from 54.8 MB to 13.0 MB**, and from 8,080 files to
  3,785. The package included an entire build input directory with its
  dependencies, seven 1024×1024 images used as 16-pixel icons, and screenshots
  already served from GitHub.
- **Strictness is resolved once.** The gate and the agent previously read it from
  different places and could disagree — which mattered, because strictness
  decides whether coverage findings fail the verdict. The `AGENTS.md` lookup now
  finds the one governing your specification rather than only the workspace root.
- **The Marketplace listing and README** lead with what the extension does for a
  repository under specification governance rather than with the agent panel.

### Security

- Resolved both high-severity advisories in production dependencies (`tmp` path
  traversal, `brace-expansion` denial of service), and updated mermaid to a
  release carrying a patched DOMPurify — relevant because the agent panel renders
  model-authored mermaid diagrams.

### Removed

- **The "Open RQML Ideas" command**, which only ever displayed a "coming soon"
  message. Its acceptance criterion has been withdrawn from the specification
  rather than left standing as an unmet obligation.
- Six configuration settings that nothing read.

## [1.1.8] — 2026-06-06

### Added
- **Claude Opus 4.8** is now the default Anthropic model, with its full 1,000,000-token context window. It uses Anthropic's adaptive thinking API.
- **Live working-indicator stats.** While the agent is working, the animated "R" now shows elapsed time and cumulative tokens used (white text with an RQML-purple separator dot), updated as each step completes.

### Fixed
- **Claude Opus 4.8 thinking failure.** Fixed an *HTTP 400 "thinking.type.enabled is not supported for this model"* error. Newer Anthropic models use the adaptive thinking API (`thinking.type.adaptive`); the agent now selects the correct thinking API per model while older models keep the legacy budget-based thinking.
- **Silent failures on some providers.** Some providers (e.g. OpenAI) emit a streaming error and then end the stream cleanly without throwing, which previously produced no message at all. The agent now surfaces these errors. Combined with clearer formatting, LLM failures now report the real provider cause (HTTP status, provider message, and an actionable hint) inline, with full detail logged to the **RQML** output channel.
- **Cross-provider reasoning leakage.** After switching providers mid-conversation (e.g. Anthropic → OpenAI), provider-specific reasoning blocks from earlier turns are no longer replayed to the new provider, eliminating *"Non-OpenAI reasoning parts are not supported"* warnings and related issues.

## [1.1.7] — 2026-05-31

### Changed
- **Core functionality externalized into `rqml-core`.** The shared RQML parsing, validation, and document logic that previously lived inside the extension has been factored out into the standalone `rqml-core` library. The extension now consumes `rqml-core`, keeping the two in lockstep and making the core reusable across other tools.
- **New RQML object model.** Spec exports are now driven by a proper RQML object model rather than ad-hoc serialization. This greatly increases the quality and fidelity of generated spec exports (PDF, Word, PowerPoint, Excel) — sections, relationships, and structured content are represented faithfully end to end.

### Fixed
- **Spec export schema validation.** Fixed an *"Invalid schema for response_format"* error when generating reports with OpenAI strict structured-output models. The report output schema's optional/defaulted fields (`layoutHint`, `subtitle`) are now expressed as nullable so every property is included in the schema's `required` set.

## [0.1.6] — 2026-05-24

### Added
- **Streamed reasoning ("thinking") panel.** For reasoning-capable models (Claude Opus / Sonnet with extended thinking, DeepSeek Reasoner, OpenAI o-series, Gemini thinking modes, Grok 4, Groq DeepSeek R1 distill, Qwen QwQ), the agent now streams the model's reasoning trace to the conversation UI in real time, in a dim italic panel attached to the in-progress assistant message. The panel auto-collapses to *"Thought for 12s ▸"* once the final answer begins streaming, and can be expanded again at any time to inspect the full trace.
- **Anthropic extended thinking** is enabled automatically for reasoning-capable Claude models via `providerOptions.anthropic.thinking`. The thinking budget is tunable via the new `rqml.reasoningBudgetTokens` setting (default 4000, range 1024–64000).
- New provider catalog field `reasoning` (`'native' | 'anthropic-thinking' | 'none'`) lets the agent know how each provider exposes reasoning.

### Spec changes
- Added REQ-AGT-028 (reasoning stream capture) and REQ-AGT-029 (reasoning UI panel) to PKG-AGENT, plus trace edges TR-148 through TR-150.

## [0.1.5] — 2026-04-26

### Fixed
- **Activation failure on upgrade.** Extension activation failed with *"Unable to write to User Settings because rqml.activeModel is not a registered configuration"* when the singleton-per-provider configuration tried to migrate or persist the active model. The new `rqml.activeModel` setting is now properly declared in `package.json`, so VS Code accepts writes to it. (Affected the 0.1.4 release.)

### Added
- New redesigned **Traceability Matrix** view (PKG-MATRIX). Opens as a tab in the editor area with a title that includes the active `.rqml` file name. Shows a requirements-centred table with columns for ID, Title, Type, Status, Priority, Owner, Goals, Rationale, Design Artifact, Implementation, Test Cases, Verification, Sync, Impact, Relationships, and Warnings. Includes a click-to-filter summary strip, a search field with multi-field matching, sortable sticky-header columns, sticky-left ID/Title/Status/Verification, a collapsible detail panel for the selected row, source navigation from any chip, and theme-compatible status pills.

## [0.1.4] — 2026-04-24

### Added
- **Expanded provider catalog** — adds **xAI (Grok)**, **Mistral**, **Groq**, **DeepSeek**, and **Perplexity**, bringing the total to 9 built-in LLM providers with 40+ models.
- **Automatic environment-variable detection** — keys in `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY`/`GEMINI_API_KEY`, `AZURE_API_KEY` + `AZURE_RESOURCE_NAME`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, and `PERPLEXITY_API_KEY` are picked up automatically at startup. No configuration step required.
- `/provider new` and `/provider remove [<id>]` slash commands (add/remove providers directly from the agent prompt).

### Changed
- **Singleton-per-provider architecture.** Providers are now singletons — one key per provider. The old "multi-endpoint" concept (named endpoints, multiple keys per provider) is gone.
- `RQML: Add LLM Endpoint` is now `RQML: Add LLM Provider`. Setup is a two-step flow: pick a provider → provide an API key (or accept the env var if one is present).
- `RQML: Remove LLM Endpoint` is now `RQML: Remove LLM Provider`.
- `RQML: Select Active LLM Endpoint` is removed — the active model (a single `{provider, modelId}` pair) replaces the concept of "active endpoint". Switching models across providers automatically switches the active provider.
- Model dropdown in the agent input box now shows every model from every configured provider, grouped by provider.
- User-level customisation of the catalog (custom models, overrides, hidden entries) is no longer supported. The curated catalog is the single source of truth.
- `/providers` output now reports each provider's key source (stored / env var / not configured).
- `/keys` output distinguishes stored keys (masked) from env-var-sourced keys (named).

### Migration
- On first activation, any stored endpoint keys from the pre-0.2 scheme are **copied** to the new per-provider slot. If an active endpoint had a model selected, that model becomes the active model. A one-time notification reports how many keys were migrated. Old settings and endpoint-scoped secrets are then cleaned up.

### Spec changes
- Added REQ-CFG-013 (singleton-per-provider architecture) and REQ-CFG-014 (environment variable auto-detection) to PKG-CONFIG.
- Deprecated REQ-CFG-008, REQ-CFG-010, REQ-CFG-011, REQ-CFG-012, and REQ-MDL-002 (superseded by REQ-CFG-013).
- Added trace edges TR-134 through TR-140.

## [0.1.3] — 2026-04-20

### Added
- **Side-by-side diff view for proposed changes.** When the agent proposes a spec change or a file write, the approval UI now renders a structured diff with old content on the left (deletions highlighted red) and new content on the right (additions highlighted green). Changed lines are aligned row-by-row for easier scanning.
- New files in `writeFile` tool approvals render as a single green column (clearly indicating all lines are new).

### Changed
- `ToolApprovalCard` now shows a "Show diff" toggle (replacing "Show preview") when a structured diff is available. The plain-text preview is still used as a fallback.
- Spec change proposals are computed against the current spec content at extraction time, so the visual diff reflects ground truth rather than the LLM's descriptive `DIFF:` line.

## [0.1.1] — 2026-04-20

### Fixed
- Marketplace listing image URLs are now resolved correctly. The extension is published from the `extension/` subdirectory of the repository, so relative image paths needed an explicit base URL.

### Changed
- Added `repository.directory` field to `package.json` so tooling correctly identifies the package as a subdirectory of the repository.
- Added npm scripts (`package`, `package:pre`, `publish`, `publish:pre`) that pass `--baseImagesUrl` and `--baseContentUrl` to `vsce` so published listings resolve relative paths against the correct subdirectory.

## [0.1.0] — 2026-04-19

**Initial pre-release.** RQML for VS Code brings spec-first development into your editor — a durable requirements specification alongside your code, with an integrated AI agent that guides you through the Spec → Design → Plan → Code → Verify workflow.

### Added

#### RQML Browser (sidebar)
- Activity Bar icon and dedicated RQML sidebar
- Three-region layout: **Overview** (tree), **Details** (properties), **Traces** (trace edges) with resizable dividers
- Visual distinction for missing sections in the tree view
- Context menu actions: *Go to Definition*, *Rename*, *Delete*, *Add Item*
- Empty state with a clickable *Create RQML Spec* action when no `.rqml` file is present
- Toolbar actions for opening the Document View, Trace Graph, Matrix View, and Export wizard
- Multi-spec support — multiple `.rqml` files per workspace with a QuickPick switcher in the status bar
- Monorepo-aware discovery — searches the workspace recursively and walks parent directories
- Active spec selection persisted per workspace

#### `.rqml` language support
- Language registration for `.rqml` files (syntax highlighting via TextMate grammar)
- Real-time XML well-formedness, XSD schema, and semantic validation
- Diagnostics reported to the Problems panel
- Go-to-definition from tree view items to their source line
- Automatic XSD version selection based on the spec's declared version
- Status bar indicator showing spec health (no-spec / invalid / incomplete / synced) with click-to-action

#### Multiple stakeholder views
- **Document View** — rendered, navigable HTML representation of the spec
- **Requirements Matrix** — cross-reference of requirements against verification items with color-coded coverage
- **Trace Graph** — interactive node-and-edge visualization of requirement relationships

#### RQML Agent
- Integrated LLM-powered agent in the VS Code panel (alongside Terminal and Problems)
- Multi-provider support via the Vercel AI SDK: **Anthropic**, **OpenAI**, **Azure OpenAI**, **Google**
- Model catalog with Claude Opus 4.7, Claude Sonnet 4.6, Claude Haiku 4.5, GPT-4o, Gemini 3 Pro, and more
- Secure API key storage via VS Code Secret Storage
- Streaming responses with a live cursor indicator
- Agentic tool loop with approval gates for file and spec modifications
- File and folder attachments with context injection
- Mermaid diagram rendering inline in the conversation
- Model selector dropdown in the input bar
- Configurable strictness: `relaxed`, `standard`, `strict`, `certified`
- Spec health indicator with status-aware placeholder prompts
- Plan and Design Overview quick-access icons in the input bar
- Attachment preview row above the text input
- Shift-Enter for newline hint

#### Spec → Design → Plan → Code → Verify workflow (slash commands)
- **Spec** — `/elicit` for guided requirements gathering
- **Design** — `/design new|review|decide|overview|list` for architectural decisions captured as ADRs in `.rqml/adr/`
  - Classification model: `required_by_spec`, `derived_from_requirements`, `discretionary_design_choice`, `implementation_detail`
  - ADR lifecycle: Proposed / Accepted / Superseded / Deprecated / Rejected
  - Zero-padded sequential numbering (`0001-kebab-case-slug.md`)
- **Plan** — `/plan [--full]` creates or reviews a staged implementation plan at `.rqml/plan.md`
- **Code** — `/cmd` generates coding-agent prompts; `/implement` runs the agentic implementation loop
- **Verify** — `/sync`, `/lint` for spec-code synchronisation and spec quality checks

#### Additional slash commands
- Session management: `/help`, `/about`, `/clear`, `/new`, `/compact`
- Providers and models: `/providers`, `/provider use`, `/keys`, `/key set|test`, `/llm`, `/models`, `/model use|test`
- Quality and health: `/status [--full]`, `/validate`, `/score [--full]`
- Traceability: `/trace <REQ-ID>`, `/diff [--full]`
- Sync: `/sync status|scan`
- Diagnostics: `/doctor`, `/logs`, `/feedback`, `/diagnostics`
- Skills: `/skills list|show|refresh`

#### Command Palette integration
- All major slash commands available with the `RQML:` prefix in the Command Palette
- Input prompts for commands that require arguments

#### Agent Skills support
- Implementation of the open [Agent Skills](https://agentskills.io/) standard
- Skill discovery from three locations:
  - `~/.agents/skills/` — user-level cross-client
  - `<workspace>/.agents/skills/` — project-level cross-client
  - `<workspace>/.rqml/skills/` — RQML-specific
- Skill catalog automatically injected into agent system prompts
- Model-driven activation — the agent reads full `SKILL.md` content when a skill is relevant

#### Export wizard
- 14+ report types including Full Requirements Specification, Investor Presentation, Project Status Report, Release Readiness Review, API and Integration Specification, Verification and Acceptance Pack, Baseline Release Specification, Stakeholder Review Pack, Requirements Register, Traceability Matrix, Requirements-to-Tests Matrix, and Interface Inventory
- Output formats: **PDF**, **Word (DOCX)**, **PowerPoint (PPTX)**, **Excel (XLSX)**, **Markdown**
- LLM-driven content generation with optional user guidance
- Multi-step wizard: section selection → report type → format → LLM guidance → model

#### Init Spec wizard
- `RQML: Init Spec` command with a guided multi-step flow (filename, document ID, title)
- Automatic creation of a valid `.rqml` file using the latest available XSD version

### Known limitations

- Command Palette arguments for some complex slash commands (e.g., `/trace`) are collected via plain input boxes rather than tailored pickers
- `/export` session export is planned but not yet implemented
- `/rename` and `/delete` tree actions currently point to manual editing; automated XML editing is planned for a future release
- File watchers cannot observe spec files located above the VS Code workspace root in monorepo setups — parent-directory specs are discovered at startup and on manual refresh

### Requirements

- Visual Studio Code **1.108 or later**
- An LLM provider (Anthropic, OpenAI, Azure OpenAI, or Google) — optional for browser, language, and export features; required for RQML Agent

---

[0.1.6]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.6
[0.1.5]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.5
[0.1.4]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.4
[0.1.3]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.3
[0.1.1]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.1
[0.1.0]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.0
