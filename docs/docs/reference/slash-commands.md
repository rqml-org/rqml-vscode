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

Show agent version and environment info including the loaded spec status, active endpoint, model, and strictness setting.

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

**Requires:** LLM endpoint configured

### `/export`

Export the current conversation as markdown.

```
/export
```

*Planned — not yet implemented.*

---

## Provider & Model Management

### `/providers`

List all configured LLM endpoints with their connection status and active indicator.

```
/providers
```

**Alias:** `/endpoints`

### `/provider`

View or switch the active LLM endpoint.

```
/provider
/provider use <endpoint-name>
```

- Without arguments: shows the current active endpoint.
- `use <name>`: switches the active endpoint to the named one.

### `/keys`

Manage API keys for LLM endpoints.

```
/keys
/keys set
/keys test
```

**Alias:** `/key`

| Subcommand | Description |
|---|---|
| *(none)* | Show API key status for all endpoints (keys are never revealed) |
| `set` | Set the API key for the active endpoint (opens a secure input) |
| `test` | Test connectivity for the active endpoint |

### `/llm`

Show a quick one-line LLM status — the active endpoint name and whether it's ready.

```
/llm
```

### `/models`

List models in the catalog for the active provider.

```
/models
/models --all
```

| Flag | Description |
|---|---|
| `--all` | Show models from all providers, grouped by provider |

The currently active model is marked in the output.

### `/model`

View or switch the active model for the current endpoint.

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
| `test` | Test connectivity for the active (or specified) model |

Model matching is case-insensitive and supports partial matches. If multiple models match, a disambiguation prompt is shown.

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

**Requires:** Spec loaded, LLM endpoint configured

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

**Requires:** Spec loaded, LLM endpoint configured

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

**Requires:** Spec loaded. `scan` also requires LLM endpoint.

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

**Requires:** Spec loaded, LLM endpoint configured

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

**Requires:** LLM endpoint configured

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

The plan is persisted to `.rqml/rqml-implementation-plan.md`.

**Requires:** Spec loaded, LLM endpoint configured

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

**Requires:** Spec loaded, LLM endpoint configured, a `/plan` must have been generated first

### `/implement`

Implement the next stage of the plan (or a specific requirement) using the agent's tool loop.

```
/implement
/implement <REQ-ID | PKG-ID>
```

The agent will read files, propose changes, and request approval before modifying code.

**Requires:** Spec loaded, LLM endpoint configured

---

## Diagnostics

### `/doctor`

Run a health check on the extension environment: spec status, endpoint configuration, LLM readiness, strictness level, and registered command count.

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
