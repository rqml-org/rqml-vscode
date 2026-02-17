<p align="center">
  <img src="images/rqml-icon.png" alt="RQML" width="128" />
</p>

<h1 align="center">RQML for VS Code</h1>

<p align="center">
  <strong>Your requirements are the product. The code is derived.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=Stakkar.rqml-vscode"><img src="https://img.shields.io/visual-studio-marketplace/v/Stakkar.rqml-vscode?label=VS%20Code%20Marketplace" alt="VS Code Marketplace" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Stakkar.rqml-vscode"><img src="https://img.shields.io/visual-studio-marketplace/i/Stakkar.rqml-vscode" alt="Installs" /></a>
  <a href="https://rqml.org"><img src="https://img.shields.io/badge/spec-rqml.org-blue" alt="RQML Spec" /></a>
</p>

---

LLMs write most of the code now. But without structured intent, every session starts from scratch — context is lost, quality drifts, and the codebase becomes the only source of truth.

**RQML changes that.** It's an [open XML standard](https://rqml.org) for capturing requirements that both humans and LLMs can read. This extension brings RQML into VS Code with an AI-powered agent that keeps your specification and codebase in sync — so your LLMs always have the context they need to produce better code.

<!-- TODO: Replace with hero screenshot or GIF -->
> ![RQML Agent in action](images/hero-screenshot.png)
> *The RQML Agent monitors your spec and codebase, flags quality issues, and suggests improvements — all from within VS Code.*

## Why RQML?

| Without RQML | With RQML |
|---|---|
| Each LLM session starts from zero context | Persistent, structured context across every session |
| Requirements live in scattered tickets and docs | Single `.rqml` file is the source of truth |
| Code quality depends on prompt craftsmanship | Code quality is anchored to verified requirements |
| No traceability between intent and implementation | Full traceability from goals to code to tests |
| Repeated prompting burns tokens | Reusable context reduces token consumption over time |

## Features

### AI-Powered Requirements Agent

A dedicated agent panel that monitors your RQML specification and codebase in real time. It catches quality issues, suggests improvements, and flags when code drifts from the spec — without ever modifying your source code.

<!-- TODO: Replace with agent panel screenshot -->
> ![Agent Panel](images/agent-panel.png)

- Continuous quality assessment: flags vague language, missing acceptance criteria, untraceable requirements
- Spec-code drift detection: notifies you when code changes don't match the specification
- Change proposals with diff preview — nothing is applied without your approval
- Configurable strictness levels: **relaxed**, **standard**, **strict**, **certified**

### 30+ Slash Commands

A terminal-style command system for power users. Type `/` in the agent prompt to access everything from quality scoring to implementation planning.

<!-- TODO: Replace with slash command screenshot -->
> ![Slash Commands](images/slash-commands.png)

**Quality & Validation**
- `/status` — Full quality assessment with scoring breakdown
- `/score` — Quick scoring summary
- `/lint` — Run lint rules with optional auto-fix
- `/validate` — Validate against the RQML XSD schema

**Implementation Planning**
- `/plan` — Analyse spec readiness and generate a staged implementation plan
- `/cmd` — Generate copy-pasteable instructions for your coding agent (Cursor, Claude Code, Copilot, etc.)

**Sync & Traceability**
- `/sync status` — Report drift between spec and code
- `/trace REQ-ID` — Show implementation and test evidence for any requirement

**Session & LLM Management**
- `/providers`, `/models`, `/model use` — Switch between LLM providers and models on the fly
- `/model test` — Verify connectivity and measure latency
- `/clear`, `/new`, `/export` — Manage conversation sessions

### Multi-Provider LLM Support

Bring your own API key. The extension works with all major LLM providers through the Vercel AI SDK.

| Provider | Models |
|---|---|
| **OpenAI** | GPT-5.2, GPT-5.2 Pro, GPT-5.1, GPT-5, GPT-4o, and more |
| **Anthropic** | Claude Opus 4.6, Claude Sonnet 4.5, Claude Haiku 4.5 |
| **Google** | Gemini 3 Pro, Gemini 3 Flash, Gemini 2.0 Flash |
| **Azure OpenAI** | All Azure-hosted OpenAI models |

- QuickPick model selector grouped by provider
- Automatic endpoint switching when you pick a model from a different provider
- Per-endpoint model persistence
- Fallback model configuration for resilience

### Specification Explorer

A full sidebar experience for navigating your RQML specification.

<!-- TODO: Replace with sidebar screenshot -->
> ![Sidebar](images/sidebar.png)

- **Tree View** — Navigate the full spec hierarchy: goals, requirements, features, test cases, traces
- **Details Panel** — Inspect properties of any selected element
- **Trace Panel** — Visualise traceability links
- Four dedicated views accessible from the toolbar:
  - **Document** — WYSIWYG full-spec rendering
  - **Graph** — Traceability map
  - **Matrix** — Requirements-to-test-cases grid with status coloring
  - **Ideas** — AI-generated suggestions for spec improvements

### Document Export

Share your specification with stakeholders in their preferred format.

- **HTML** (free) — Clean, readable web document
- **PDF** (pro) — Professional printable output
- **Markdown** (pro) — For inclusion in repos and wikis
- **Word** (pro) — For enterprise review workflows

## Quick Start

### 1. Install the extension

Search for **"RQML"** in the VS Code Extension Marketplace, or:

```
code --install-extension Stakkar.rqml-vscode
```

### 2. Create your first RQML spec

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

```
RQML: Create Spec
```

This generates a `requirements.rqml` file in your project root with starter structure.

### 3. Connect an LLM

Open the Command Palette and run **RQML: Add LLM Endpoint**. Choose your provider, paste your API key, and you're ready.

### 4. Start the agent

Click the RQML icon in the Activity Bar to open the sidebar, then open the **RQML Agent** panel. Type `/help` to see what the agent can do, or just start asking questions about your requirements.

### 5. (Optional) Add AGENTS.md

Download [`AGENTS.md`](https://rqml.org/AGENTS.md) to your project root. This tells your coding agents (Cursor, Claude Code, etc.) to follow spec-first development using your RQML file as the source of truth.

## Extension Settings

This extension contributes the following settings:

| Setting | Description |
|---|---|
| `rqml.llmEndpoints` | Configured LLM endpoints |
| `rqml.activeEndpointId` | Currently active endpoint |
| `rqml.modelSelections` | Per-endpoint model selections |
| `rqml.modelCatalog.customModels` | User-added model entries |
| `rqml.modelCatalog.hiddenModels` | Hidden default catalog entries |
| `rqml.modelCatalog.overrides` | Metadata overrides for catalog models |
| `rqml.modelCatalog.fallbackModels` | Fallback model per endpoint |
| `rqml.strictnessLevel` | Agent strictness: relaxed, standard, strict, certified |

API keys are stored securely using VS Code's built-in SecretStorage API and are never written to settings files.

## How RQML Works with Your Coding Agent

```
                    ┌─────────────┐
                    │  RQML Spec  │ ← Source of truth
                    │  (.rqml)    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  RQML    │ │  Coding  │ │  Your    │
        │  Agent   │ │  Agent   │ │  Team    │
        │ (this    │ │ (Cursor, │ │          │
        │  ext.)   │ │  Claude  │ │          │
        │          │ │  Code…)  │ │          │
        └──────────┘ └──────────┘ └──────────┘
          Reviews &    Generates     Reviews &
          improves     code from     approves
          the spec     the spec      changes
```

The RQML extension is the **spec side** of the workflow. It maintains, validates, and improves your requirements. Your coding agent reads the spec and generates code from it. The result: code that is traceable, intentional, and aligned with documented requirements.

## Learn More

- [RQML Specification](https://rqml.org) — The open standard
- [Quick Start Guide](https://rqml.org/docs/quick-start) — Get started in 5 minutes
- [User Guide](https://rqml.org/docs/user-guide) — Full documentation
- [Schema Reference](https://rqml.org/docs/reference) — XSD schema and element reference

## Feedback & Issues

Found a bug or have a feature request? [Open an issue](https://github.com/stakkar/rqml-vscode/issues) on GitHub.

---

<p align="center">
  <em>You maintain the spec. The code is derived.</em>
  <br/>
  <a href="https://rqml.org">rqml.org</a>
</p>
