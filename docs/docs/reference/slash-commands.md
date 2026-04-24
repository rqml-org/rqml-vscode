---
sidebar_position: 1
---

# Slash Commands

The RQML agent accepts slash commands in its prompt input. Type `/` to see autocomplete suggestions, or use `/help` to list all commands.

Commands use terminal-style syntax: `/command [subcommand] [args] [--flags]`.

---

## Help & Discovery

### `/help`

Show available commands or detailed help for a specific command.

```
/help [command]
```

**Aliases:** `/?`, `/commands`

- Without arguments: lists all commands grouped by category.
- With a command name: shows usage, description, and examples for that command.

### `/about`

Show agent version and environment info including the loaded spec status, active provider, model, and strictness setting.

```
/about
```

---

## Session Management

### `/clear`

Clear the conversation history and terminal output. Settings and attachments are preserved.

```
/clear
```

### `/new`

Start a fresh conversation. Resets the message history but keeps terminal output visible.

```
/new
```

### `/compact`

Summarise the current conversation into compact working memory to reduce token usage while preserving key context.

```
/compact
```

**Requires:** LLM provider configured

### `/export`

Export the current conversation as markdown.

```
/export
```

*Planned — not yet implemented.*

---

## Provider & Model Management

The RQML agent uses a curated catalog of providers and models. Each provider is a singleton — at most one API key per provider. Keys are resolved from VS Code Secret Storage first, falling back to well-known environment variables (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). See the [RQML Agent user guide](../user-guide/agent.md#providers-and-keys) for the full list.

### `/providers`

List all providers in the catalog and their current configuration status (stored key / env var / none).

```
/providers
```

**Alias:** `/endpoints`

### `/provider`

Add, remove, or inspect LLM providers.

```
/provider
/provider new
/provider remove [<id>]
```

| Subcommand | Description |
|---|---|
| *(none)* | Show the active provider and model |
| `new` | Add a new provider (runs `RQML: Add LLM Provider`) |
| `remove [<id>]` | Remove a stored provider key |

### `/keys`

Inspect or update provider API keys.

```
/keys
/keys set
/keys test
```

**Alias:** `/key`

| Subcommand | Description |
|---|---|
| *(none)* | Show key status for every provider (stored / env / none, masked) |
| `set` | Open `RQML: Add LLM Provider` to add or replace a key |
| `test` | Make a lightweight call to verify the active provider's key works |

### `/llm`

Show a quick one-line LLM status — the active provider, active model, and readiness.

```
/llm
```

### `/models`

List available models — those from providers with a configured key. Grouped by provider.

```
/models
/models --all
```

| Flag | Description |
|---|---|
| `--all` | Show the full catalog, including models from providers without a key |

The currently active model is marked with `*` in the output.

### `/model`

View or switch the active model.

```
/model
/model use [<model-id>]
/model test [<model-id>]
```

| Subcommand | Description |
|---|---|
| *(none)* | Show the current active model and its details |
| `use <id>` | Set the active model by ID or partial name |
| `use` | Open the model picker for interactive selection |
| `test [<id>]` | Test connectivity for the active (or specified) model |

Model matching is case-insensitive and supports partial matches. Switching to a model from a different provider automatically switches the active provider.

---

## Quality & Health

### `/status`

Show a summary of the current spec, including section counts, trace edges, and diagnostics.

```
/status
/status --full
```

| Flag | Description |
|---|---|
| `--full` | Run an LLM-based quality assessment with detailed analysis |

**Requires:** Spec loaded

### `/validate`

Run full validation (XML well-formedness, XSD schema, semantic rules) and display results grouped by severity.

```
/validate
```

**Requires:** Spec loaded

### `/lint`

Run semantic checks and report quality issues: vague language, non-atomic requirements, untestable criteria, missing traces, orphans, and naming violations.

```
/lint
```

**Requires:** Spec loaded, LLM provider configured

### `/score`

Rate the spec quality across multiple dimensions, each scored 1–10.

```
/score
/score --full
```

**Dimensions:** Completeness, Traceability, Quality, Structure, Consistency.

| Flag | Description |
|---|---|
| `--full` | Include a detailed breakdown with per-dimension justifications |

**Requires:** Spec loaded, LLM provider configured

---

## Sync & Traceability

### `/sync`

Check synchronisation status between the spec and codebase.

```
/sync
/sync status
/sync scan
```

| Subcommand | Description |
|---|---|
| `status` | Quick sync summary — trace edge counts, untraced requirements (default) |
| `scan` | Deep LLM-based sync scan identifying drift between spec and code |

**Requires:** Spec loaded. `scan` also requires an LLM provider.

### `/trace`

Show all trace edges for a specific requirement.

```
/trace <REQ-ID>
```

Displays outgoing and incoming trace edges with their types (`dependsOn`, `refines`, `satisfies`, `constrains`) and notes.

**Example:** `/trace REQ-UI-001`

**Requires:** Spec loaded

### `/diff`

Compare the spec against the implementation and report coverage.

```
/diff
/diff --full
```

| Flag | Description |
|---|---|
| *(none)* | Brief one-line-per-area coverage summary |
| `--full` | Detailed structured diff report |

**Requires:** Spec loaded, LLM provider configured

---

## Planning & Implementation

### `/elicit`

Elicit and draft new requirements through guided LLM questioning.

```
/elicit
/elicit <topic>
```

- Without arguments: starts a general elicitation session based on the current spec (or from scratch if no spec exists).
- With a topic: focuses the elicitation on a specific area.

**Requires:** LLM provider configured

### `/design`

Explore and document architectural design decisions as Architecture Decision Records (ADRs).

```
/design
/design new <topic>
/design review <ADR-ID | keyword>
/design decide <ADR-ID | keyword>
/design overview
/design list
```

| Subcommand | Description |
|---|---|
| `new <topic>` | Start a new design decision — classifies, assesses ADR-worthiness, explores options |
| `review <ADR>` | Revisit an existing ADR against current requirements and implementation |
| `decide <ADR>` | Finalize a proposed ADR (sets status to Accepted) |
| `overview` | Summarize current architecture from the ADR set |
| `list` | List existing ADRs with status, classification, and date |
| *(none)* | Infer intent: overview if ADRs exist, help if none |

ADR lookup accepts a number (`1`, `0001`, `ADR-0001`) or a keyword from the filename slug.

ADRs are stored in `.rqml/adr/` with filenames like `0001-auth-strategy.md`. See the [Design stage documentation](../development-process/design.md) for details on the ADR template, classification model, and lifecycle.

**Requires:** LLM provider configured

### `/plan`

Review the current implementation plan and propose next steps, or regenerate the entire plan.

```
/plan
/plan --full
/plan <REQ-ID | PKG-ID>
```

| Flag / Arg | Description |
|---|---|
| *(none)* | Review the existing plan and suggest next steps |
| `--full` | Regenerate the entire plan from scratch |
| `<target>` | Scope the plan to a specific requirement or package |

The plan is persisted to `.rqml/plan.md`.

**Requires:** Spec loaded, LLM provider configured

### `/cmd`

Generate a concise, copy-pasteable coding-agent prompt for the next implementation step.

```
/cmd
/cmd next
/cmd all
/cmd next <REQ-ID | PKG-ID>
```

| Subcommand | Description |
|---|---|
| `next` | Generate a prompt for the next unimplemented stage (default) |
| `all` | Generate prompts for all remaining stages |

The output is a high-level reference prompt (no code snippets) suitable for pasting into Claude Code, Copilot Chat, Cursor, or any other coding agent.

**Requires:** Spec loaded, LLM provider configured, a `/plan` must have been generated first

### `/implement`

Implement the next stage of the plan (or a specific requirement) using the agent's tool loop.

```
/implement
/implement <REQ-ID | PKG-ID>
```

The agent will read files, propose changes, and request approval before modifying code.

**Requires:** Spec loaded, LLM provider configured

---

## Diagnostics

### `/doctor`

Run a health check on the extension environment: spec status, provider configuration, LLM readiness, strictness level, and registered command count.

```
/doctor
```

### `/logs`

Show instructions for accessing extension logs via the VS Code Output panel and Developer Tools console.

```
/logs
```

### `/feedback`

Show instructions for reporting issues or giving feedback, including the "RQML: Report Issue" command palette action.

```
/feedback
```
