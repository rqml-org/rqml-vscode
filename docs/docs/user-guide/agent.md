---
sidebar_position: 4
---

# RQML Agent

The RQML Agent is an LLM-powered assistant that lives in the bottom panel of VS Code (alongside Terminal and Problems). It guides you through the [Spec → Design → Plan → Code](../development-process/index.md) development workflow and provides interactive access to all RQML operations through slash commands.

![RQML Agent](/img/screenshots/RQML-agent-screenshot.png)

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
| **Verify** | `/sync`, `/validate`, `/lint`, `/score` | Check spec-code sync and quality |

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
