---
sidebar_position: 1
---

# Introduction

**RQML for VS Code** is a requirements engineering extension that brings structured, spec-driven development into your editor. It lets you write, browse, trace, and evolve living requirements specifications alongside your code — with built-in support for LLM coding agents.

## What is RQML?

RQML (Requirements Markup Language) is an XML-based format for writing machine-readable, human-reviewable software requirements. An RQML spec captures goals, requirements, acceptance criteria, scenarios, test cases, and traceability links in a single versioned file that lives in your repository.

## What does the extension do?

The RQML VS Code extension provides:

- **RQML Browser** — A sidebar with tree view, details panel, and traces panel for navigating your spec
- **Language support** — Syntax highlighting, validation, and diagnostics for `.rqml` files
- **Document views** — Readable document view, requirements matrix, and trace graph visualizations
- **RQML Agent** — An LLM-powered assistant that guides you through the [Spec → Design → Plan → Code → Verify](./development-process/index.md) workflow
- **Exports** — Generate reports in PDF, Word, PowerPoint, Excel, and Markdown using LLM-driven content generation

## Who is it for?

- **Teams building with coding agents** who need a stable source of truth that outlasts any single prompt
- **Engineers** who want requirements, verification, and implementation tied together in version control
- **Product-minded developers** who want system intent to live in the repository, not in Slack threads
- **Projects that have outgrown prompt-only development** and need structure without heavyweight tooling

## Quick start

1. **Install** the RQML extension from the VS Code marketplace
2. **Create a spec** — Click "Create RQML Spec" in the RQML Browser sidebar, or run `RQML: Init Spec` from the Command Palette
3. **Elicit requirements** — Open the RQML Agent panel and type `/elicit` to start a guided requirements gathering session
4. **Design** — Use `/design new <topic>` to make and record architectural decisions
5. **Plan** — Run `/plan --full` to generate a staged implementation plan
6. **Implement** — Use `/implement` to execute the plan with the agent, or `/cmd` to generate prompts for your preferred coding agent
7. **Verify** — Run `/sync` to check spec-code synchronisation and `/lint` to flag spec quality issues

See the [Development Process](./development-process/index.md) section for a detailed walkthrough of each stage, or the [User Guide](./user-guide/index.md) for a tour of the extension's features.
