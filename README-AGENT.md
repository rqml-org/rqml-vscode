# RQML Agent — Slash Command Guide (README-AGENT.md)

This document describes the **slash commands** supported by the **RQML Agent** in the RQML VS Code extension.

The RQML Agent helps you:
- Author and improve RQML specifications
- Enforce good software engineering practices (clarity, testability, structure)
- Validate and lint RQML (schema + quality rules)
- Assess **spec ↔ code sync** and maintain traceability
- Manage LLM providers/models/API keys via the **Vercel AI SDK**
- Plan spec implamentation and generate commands for coding agents.

---

## Command syntax

Commands use a terminal-style format:

- `/command [args] [--flags]`
- Some commands accept `--full` for detailed output.
- Commands that generate structured data may support `--json`.

---

## 0) Help and discovery

### `/help [command]`
Show help. If `command` is provided, shows detailed usage.

Examples:
- `/help`
- `/help status`

### `/?` 
An alias for `/help`

### `/commands`
Quick list of all commands.

### `/about`
Show extension/agent metadata and active runtime configuration (workspace, active RQML file, provider/model).

---

## 1) Session and context management

### `/clear`
Clear the current chat transcript (keeps settings).

### `/new [name]`
Start a new agent session, optionally named.

Examples:
- `/new`
- `/new sprint-14-sync`

### `/compact [goal]`
Summarize the conversation into compact “working memory” to keep sessions efficient.

Examples:
- `/compact`
- `/compact sync analysis`
- `/compact spec authoring`

### `/export [md|json]`
Export the current session transcript and key artifacts (plans, status snapshots).

Examples:
- `/export md`
- `/export json`

---

## 2) Provider / model / API key management (Vercel AI SDK)

These commands keep the UX provider-agnostic while still enabling multi-provider configuration.

### `/providers`
List configured providers and connection status (active/inactive, key present, last error if any).

### `/provider use <name>`
Set the active provider.

Example:
- `/provider use anthropic`

### `/models [provider]`
List available models for a provider (uses cache; may refresh depending on implementation).

Examples:
- `/models`
- `/models openai`

### `/model use <modelId>`
Set the active model for the current provider.

Example:
- `/model use gpt-4.1`

### `/keys`
Show which providers have keys configured (never prints secrets). Also indicates storage (Secret Storage vs env var).

### `/key set <provider>`
Securely set an API key for a provider (stored in VS Code Secret Storage).

Example:
- `/key set openai`

### `/key unset <provider>`
Remove a stored key for a provider.

Example:
- `/key unset anthropic`

### `/key test [provider]`
Run a minimal connectivity test (e.g., tiny request) and report success/failure.

Examples:
- `/key test`
- `/key test openai`

### `/llm`
One-line summary of active provider/model and key status.

Example output:
- `Provider=anthropic Model=claude-... Key=ok Streaming=on`

#### Optional v1+ enhancements (if implemented)
- `/model params`
- `/model params set temperature=0.2 maxTokens=4000`

---

## 3) RQML spec quality and health

### `/status [--full]`
**Flagship command.** Provides a quality assessment of the RQML spec and its alignment with code.

Default (short) output typically includes:
- Overall quality score (0–100) + grade (A/B/C)
- Schema validity (pass/fail + first error)
- Structure (required sections present, duplicates, missing fields)
- Requirement quality (ambiguity, testability, acceptance criteria coverage)
- Traceability (links to code/tests/docs)
- Sync (spec ↔ code drift summary)
- “Last updated” timestamps (spec + code index)

`--full` adds:
- Prioritized issues grouped by category
- Suggestions and quick fixes
- Jump targets (REQ IDs, files, etc.)

Examples:
- `/status`
- `/status --full`

### `/lint [--fix] [--rules <set>]`
Run RQML lint rules. Optionally apply safe auto-fixes.

Examples:
- `/lint`
- `/lint --fix`
- `/lint --rules strict`

### `/validate [--schema <pathOrVersion>]`
Validate the RQML XML against the schema (and enforce XSD keys/uniqueness). Emits diagnostics to the Problems panel plus a summary.

Examples:
- `/validate`
- `/validate --schema v2.0.1`
- `/validate --schema ./schemas/rqml.xsd`

### `/score [quality|trace|sync]`
Print the scoring breakdown used by `/status`.

Examples:
- `/score`
- `/score quality`
- `/score sync`

---

## 4) Spec ↔ code sync and traceability

### `/sync status [--full]`
Focused drift report (spec ↔ code).

Typical signals:
- Requirements with no code refs
- Code paths with no requirement
- Stale tests vs acceptance criteria
- Changed code hotspots since last spec update

Examples:
- `/sync status`
- `/sync status --full`

### `/sync scan`
Rebuild the code index used for sync checks (symbols/tests/routes/etc.).

Example:
- `/sync scan`

### `/trace <REQ-ID> [--to code|tests|docs]`
Show evidence for where a requirement is implemented and/or tested. If missing, suggests candidate files/functions.

Examples:
- `/trace REQ-014`
- `/trace REQ-014 --to tests`

### `/link <REQ-ID> <target>`
Add or update a trace link for a requirement.

Examples:
- `/link REQ-022 src/payments/charge.ts#fn:chargeCard`
- `/link REQ-009 tests/auth/login.spec.ts`

### `/unlink <REQ-ID> <target>`
Remove a trace link.

Example:
- `/unlink REQ-022 src/payments/charge.ts#fn:chargeCard`

### `/diff [spec|code] [--since <snapshot>]`
Show what changed since a snapshot (or recent baseline).

Examples:
- `/diff spec`
- `/diff code --since sprint-14`

---

## 5) Planning implementation and interacting with coding agents

### `/plan`

Plans implementation from the **current state of the spec** and reports whether it is **implementation-ready**.

#### Usage

- `/plan`
- `/plan --full`
- `/plan --focus <area>`

Examples:
- `/plan`
- `/plan --full`
- `/plan --focus billing`
- `/plan --focus REQ-014`

#### Output contract

`/plan` always prints:

1) **Readiness verdict**
- `READY` or `NOT READY`

2) **Blocking issues (if NOT READY)**
- A short list of *specific blockers* (e.g., schema invalid, missing acceptance criteria, ambiguous requirements)
- Each blocker includes a **recommended fix** (what to change in the spec)

3) **Implementation plan (staged)**
A numbered list of stages. Each stage includes:
- **Goal / scope**
- **Inputs** (spec sections / requirement IDs)
- **Expected outputs** (code artifacts and tests)
- **Verification** (commands/tests to run)
- **Trace expectations** (how to link outputs back to requirements)

> The agent stores the latest plan internally so `/cmd` can generate commands from it.

#### Example output (illustrative)

- **Readiness:** `READY` (warnings: 4)
- **Warnings:** 3 requirements missing measurable acceptance criteria; trace coverage 12/48
- **Plan:**
  - **Stage 1 — Skeleton & interfaces**
    - Inputs: REQ-001..REQ-010
    - Outputs: new module interfaces + wiring
    - Verify: build + lint
  - **Stage 2 — Core implementation**
    - Inputs: REQ-011..REQ-024
    - Outputs: core logic
    - Verify: unit tests
  - **Stage 3 — Tests aligned to acceptance criteria**
    - Inputs: REQ-011..REQ-024
    - Outputs: integration tests
    - Verify: test suite
  - **Stage 4 — Trace links + final sync check**
    - Outputs: trace updates
    - Verify: rerun quality/sync checks

### `/cmd`

Generates **generic, copy/pasteable** instructions for coding agents based on the latest `/plan`.

These outputs are designed to work across tools:
- Terminal agents (Codex CLI, Claude Code, Copilot CLI)
- IDE chat agents (Copilot Chat, Cursor Chat)
- Web chat agents

#### Usage

- `/cmd` (same as `/cmd next`)
- `/cmd next`
- `/cmd all`

Examples:
- `/cmd`
- `/cmd next`
- `/cmd all`

#### Output contract

`/cmd` always prints **three blocks** (copy/paste friendly):

1) **AGENT PROMPT** — a structured instruction block to paste into any coding agent  
2) **CONTEXT TO LOAD** — the files/dirs the agent should open/read first  
3) **VERIFY** — local commands to run (tests/lint/build)

---

#### `/cmd next` (default)

Generates commands/prompts for **only the next stage** of the current plan (the first stage not completed).

##### Example output structure (illustrative)

**AGENT PROMPT**
- Goal: Implement Stage 1 — Skeleton & interfaces
- Constraints: follow project conventions; keep changes small; no breaking changes
- Tasks:
  1. Add module interfaces for <X>
  2. Wire into existing entrypoints
  3. Add basic error handling scaffolding
- Acceptance criteria to satisfy:
  - REQ-001: ...
  - REQ-002: ...
- Required outputs:
  - `src/<...>.ts`
  - `src/<...>.ts`
  - tests: `tests/<...>.spec.ts`
- Stop condition:
  - stop after tests pass; report summary and diff

**CONTEXT TO LOAD**
- `requirements.rqml`
- `src/...`
- `tests/...`
- `README.md` (if relevant)

**VERIFY**
- `npm test` (or detected equivalent)
- `npm run lint`
- `npm run build`

---

#### `/cmd all`

Generates prompts/commands for **every stage** of the plan, in order.

Output format:
- **Stage 1:** AGENT PROMPT + CONTEXT TO LOAD + VERIFY
- **Stage 2:** AGENT PROMPT + CONTEXT TO LOAD + VERIFY
- ...
- **Final Stage:** trace updates + final quality/sync check

This is useful if you want to execute the full plan step-by-step in a coding agent.


---

## 7) Diagnostics and troubleshooting

### `/doctor`
Check extension health:
- schema availability
- validator engine
- provider key connectivity
- workspace permissions
- indexing status

Example:
- `/doctor`

### `/logs [--tail 200]`
Show relevant extension/agent logs (redacted).

Examples:
- `/logs`
- `/logs --tail 200`

### `/feedback`
Open the feedback/report flow (issues, feature requests).

Example:
- `/feedback`

---

## Terminal interaction

The agent terminal provides a shell-like editing experience with the following features.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| **Enter** | Submit the current input |
| **Shift+Enter** | Insert a newline (multiline input) |
| **Tab** | Accept autocomplete suggestion |
| **Escape** | Dismiss autocomplete ghost text, or clear input line |
| **Up / Down** | Navigate command history |
| **Left / Right** | Move cursor one character |
| **Cmd+Left** | Move cursor to beginning of input |
| **Cmd+Right** | Move cursor to end of input |
| **Option+Left** | Move cursor one word left |
| **Option+Right** | Move cursor one word right |
| **Backspace** | Delete character before cursor |
| **Option+Backspace** | Delete word before cursor |
| **Ctrl+C** | Cancel current input |
| **Ctrl+U** | Clear (kill) the current input line |
| **Ctrl+W** | Delete the previous word |
| **Ctrl+L** | Clear the terminal screen (input preserved) |

### Command autocomplete

When you start typing a `/` command, the terminal shows a ghost-text suggestion (dim text) for the first matching command name. Press **Tab** to accept the suggestion or keep typing to narrow the match.

### Command history

Use the **Up** and **Down** arrow keys to scroll through previously submitted commands. Consecutive duplicate entries are suppressed to keep the history clean.

### Clickable requirement IDs

Requirement IDs (e.g. `REQ-UI-001`, `GOAL-001`, `TC-AUTH-003`) appearing in agent output are clickable. Clicking an ID navigates to its definition in the RQML spec file.

---
