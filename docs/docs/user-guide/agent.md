---
sidebar_position: 4
---

# RQML Agent

The RQML Agent is an LLM-powered assistant that lives in the bottom panel of VS Code (alongside Terminal and Problems). It guides you through the [Spec → Design → Plan → Code → Verify](../development-process/index.md) development workflow and provides interactive access to all RQML operations through slash commands.

![RQML Agent](/img/screenshots/RQML-agent-plan.png)

## Getting started

1. **Open the agent panel** — Click the RQML icon in the panel area, or use the Activity Bar
2. **Configure an LLM endpoint** — The agent needs an LLM provider to function. Use `/providers` to check status, or configure one in VS Code settings
3. **Start working** — Type a message or use a slash command

## Slash commands

The agent accepts slash commands typed directly in the input box. Type `/` to see autocomplete suggestions.

Commands follow terminal-style syntax:

```
/command [subcommand] [args] [--flags]
```

### Key commands by workflow stage

| Stage | Command | What it does |
|---|---|---|
| **Spec** | `/elicit [topic]` | Guided requirements gathering |
| **Design** | `/design new <topic>` | Explore and record design decisions as ADRs |
| **Plan** | `/plan [--full]` | Review or generate the implementation plan |
| **Code** | `/cmd [next\|all]` | Generate coding-agent prompts |
| **Code** | `/implement [target]` | Run the agentic implementation loop |
| **Verify** | `/sync`, `/lint` | Check spec-code synchronisation and spec quality |

### Other useful commands

| Command | What it does |
|---|---|
| `/help [command]` | List all commands or get help for a specific one |
| `/status [--full]` | Spec quality summary (or detailed LLM assessment) |
| `/doctor` | Health check — spec, endpoint, model, strictness |
| `/design list` | List existing architecture decision records |
| `/design overview` | Summarize architecture from ADRs |
| `/providers` | List configured LLM endpoints |
| `/models` | List available models |

For the full command reference, see [Slash Commands](../reference/slash-commands.md).

## Conversation features

### Free-text prompts

In addition to slash commands, you can type free-text messages. The agent responds in the context of your current spec, plan, and ADRs — all of which are included in its system prompt automatically.

### File attachments

Click the attachment icon in the input bar to attach files or folders to your message. The agent reads their contents and includes them as context. This is useful for:

- Attaching design documents or existing code for `/elicit` to analyse
- Providing implementation context during `/implement`

### Change proposals

When the agent suggests changes to your RQML spec, it uses a change proposal format that you can review and accept or reject. Code changes during `/implement` go through a tool approval flow — you see the proposed file content and confirm each write.

### Mermaid diagrams

The agent can render architecture diagrams, flowcharts, and sequence diagrams using Mermaid.js. These appear as interactive SVG diagrams directly in the conversation.

## Skills

The RQML agent supports the open [Agent Skills](https://agentskills.io/) standard for extending its capabilities with specialized knowledge and workflows. Skills let you package domain expertise — company coding standards, documentation formats, review checklists, deployment procedures — and have the agent apply them automatically.

### What is a skill?

A skill is a directory containing a `SKILL.md` file with YAML frontmatter and markdown instructions:

```
coding-standards/
└── SKILL.md
```

```yaml
---
name: coding-standards
description: Apply company coding standards. Use when reviewing or generating code.
---

## Code style rules
- Use 2-space indentation
- Prefer named exports over default exports
- All public functions must have JSDoc comments
...
```

The `name` and `description` fields are loaded into the agent's context at startup. When the agent determines a skill is relevant to the current task, it reads the full instructions and follows them.

### Where to put skills

Skills are discovered from three locations (later overrides earlier by name):

| Location | Scope | Purpose |
|---|---|---|
| `~/.agents/skills/` | User | Personal skills shared across all projects and agents |
| `<workspace>/.agents/skills/` | Project | Project skills compatible with any agent that supports the standard |
| `<workspace>/.rqml/skills/` | Project | RQML-specific project skills |

### Managing skills

Use the `/skills` command to manage discovered skills:

```
/skills              # List all discovered skills
/skills list         # Same as above
/skills show <name>  # Display full content of a skill
/skills refresh      # Re-scan skill directories
```

Skills are also automatically re-scanned when files change.

### How activation works

The agent uses **model-driven activation**: it sees the skill catalog (names and descriptions) in its system prompt and decides when a skill is relevant. When it activates a skill, it reads the full `SKILL.md` to get detailed instructions. You don't need to explicitly invoke skills — the agent picks them up based on context.

### Cross-agent compatibility

Because skills follow the open [Agent Skills standard](https://agentskills.io/), skills you create for the RQML agent also work in other compatible tools (Claude Code, GitHub Copilot, and [40+ others](https://agentskills.io/)). Skills placed in `~/.agents/skills/` or `.agents/skills/` are discoverable by any conforming agent.

## Model selection

The input bar includes a model selector dropdown. You can switch between configured LLM models without leaving the agent panel. Use `/models` to see all available models, or `/model use <id>` to switch from the command line.

## Strictness levels

The agent enforces the development process with varying strictness:

| Level | Behaviour |
|---|---|
| `relaxed` | Suggests the process, allows shortcuts |
| `standard` | Requires spec-first for features, core traces |
| `strict` | Full traceability, all behaviour specified |
| `certified` | Audit-grade, formal approval at each stage |

Configure the strictness level in VS Code settings (`rqml.agentStrictness`).
