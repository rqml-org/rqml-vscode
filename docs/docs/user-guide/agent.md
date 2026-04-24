---
sidebar_position: 4
---

# RQML Agent

The RQML Agent is an LLM-powered assistant that lives in the bottom panel of VS Code (alongside Terminal and Problems). It guides you through the [Spec → Design → Plan → Code → Verify](../development-process/index.md) development workflow and provides interactive access to all RQML operations through slash commands.

![RQML Agent](/img/screenshots/RQML-agent-plan.png)

## Getting started

1. **Open the agent panel** — Click the RQML icon in the panel area, or use the Activity Bar
2. **Add an LLM provider** — Run `RQML: Add LLM Provider` from the Command Palette, or `/provider new` from the agent prompt. Pick a provider and supply an API key (or use one from the environment — see [Providers and keys](#providers-and-keys) below)
3. **Pick a model** — Once a provider is configured, its models become available in the model dropdown above the input box. Select one.
4. **Start working** — Type a message or use a slash command

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
| `/doctor` | Health check — spec, active provider, model, strictness |
| `/design list` | List existing architecture decision records |
| `/design overview` | Summarize architecture from ADRs |
| `/providers` | List LLM providers and their key status |
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

## Providers and keys

The agent ships with a curated catalog of LLM providers and their models. You cannot add custom providers or custom model IDs — everything is predefined. To use the agent, add an API key for at least one provider.

### Supported providers

The extension includes models from:

| Provider | Typical env var |
|---|---|
| **Anthropic** (Claude) | `ANTHROPIC_API_KEY` |
| **OpenAI** (GPT) | `OPENAI_API_KEY` |
| **Google** (Gemini) | `GOOGLE_GENERATIVE_AI_API_KEY` / `GOOGLE_API_KEY` / `GEMINI_API_KEY` |
| **Azure OpenAI** | `AZURE_API_KEY` + `AZURE_RESOURCE_NAME` |
| **xAI** (Grok) | `XAI_API_KEY` |
| **Mistral** | `MISTRAL_API_KEY` |
| **Groq** | `GROQ_API_KEY` |
| **DeepSeek** | `DEEPSEEK_API_KEY` |
| **Perplexity** | `PERPLEXITY_API_KEY` |

### How keys are resolved

For each provider, the agent looks up the API key in this order:

1. **Stored key** — a key you saved via `RQML: Add LLM Provider`, kept in VS Code's Secret Storage
2. **Environment variable** — if any of the provider's well-known env vars is set when VS Code starts

The stored key always takes precedence. If you want to switch back to an env var, remove the stored key with `RQML: Remove LLM Provider`.

### Singleton providers

Each provider is a singleton — there is one key per provider. You cannot configure multiple OpenAI endpoints or name them. This simplifies setup: pick a provider, give it a key, and all its models immediately become selectable.

### Key commands

| Command | What it does |
|---|---|
| `RQML: Add LLM Provider` | Pick a provider, enter an API key |
| `RQML: Remove LLM Provider` | Delete a stored key |
| `/provider new` | Same as `RQML: Add LLM Provider` |
| `/providers` | List every provider with its key source (stored / env / none) |
| `/keys` | Show per-provider key status (stored / env var / not configured) |
| `/llm` | Quick status of the active provider and model |

## Model selection

Once at least one provider is configured, its models appear in the model dropdown at the top of the agent input box. You can also:

- Run `/model use` to open a searchable picker
- Run `/model use <id>` (or a partial name) to switch directly
- Run `/models` to list all available models grouped by provider

The active model is a single globally selected `(provider, model)` pair. Switching models across providers happens automatically when you select a model from a different provider.

## Strictness levels

The agent enforces the development process with varying strictness:

| Level | Behaviour |
|---|---|
| `relaxed` | Suggests the process, allows shortcuts |
| `standard` | Requires spec-first for features, core traces |
| `strict` | Full traceability, all behaviour specified |
| `certified` | Audit-grade, formal approval at each stage |

Configure the strictness level in VS Code settings (`rqml.agentStrictness`).
