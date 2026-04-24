# Changelog

All notable changes to the RQML for VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Per VS Code marketplace convention, odd MINOR versions (`0.1.x`) are pre-release and even MINOR versions (`0.2.x`, `0.4.x`, ...) are stable.

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

[0.1.4]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.4
[0.1.3]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.3
[0.1.1]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.1
[0.1.0]: https://github.com/rqml-org/rqml-vscode/releases/tag/v0.1.0
