---
sidebar_position: 2
---

# Stage 1: Spec

The first stage is to capture **what** you are building. The output is an RQML specification file (`.rqml`) — a structured, machine-readable requirements document that serves as the single source of truth for the entire project.

## The `/elicit` command

The RQML agent provides guided requirements elicitation through the `/elicit` slash command.

```
/elicit
/elicit <topic>
```

### How it works

The agent conducts a structured interview, asking about:

- **Goals** — What problem does this solve? What are the success metrics?
- **Scope** — What is in scope and out of scope?
- **Actors** — Who uses the system? What are their roles?
- **Acceptance criteria** — How do we know it works? (BDD-style `when`/`then` blocks)
- **Constraints** — Performance, security, compliance, or technology constraints

Based on your answers, the agent proposes well-formed RQML requirements with proper IDs, types, acceptance criteria, and traceability links.

### Modes

| Invocation | Context | Behaviour |
|---|---|---|
| `/elicit` | No spec exists | Open-ended: helps you define the system from scratch |
| `/elicit <topic>` | No spec exists | Focused: elicits requirements for a specific area |
| `/elicit` | Spec loaded | Gap analysis: reviews the spec for missing coverage |
| `/elicit <topic>` | Spec loaded | Focused addition: adds requirements for a specific topic |

### What it produces

The agent proposes changes to your `.rqml` file using change proposal blocks. You review and accept or reject each proposal. Every new requirement includes:

- A unique ID following the `REQ-{PKG}-{NNN}` pattern
- A type (`FR`, `NFR`, `UXR`, `CR`)
- A `status="draft"` marker
- BDD-style acceptance criteria
- Notes capturing any assumptions

## Creating a spec from scratch

If no `.rqml` file exists in your workspace, you can create one in two ways:

1. **RQML Browser** — Click the "Create RQML Spec" button in the sidebar
2. **Command Palette** — Run `RQML: Init Spec` to create a new spec with a guided wizard (filename, document ID, title)
3. **Agent** — Run `/elicit` and the agent will propose an initial spec structure based on your description

## Spec quality checks

Once you have a spec, use these commands to assess its quality before moving to the Design stage:

- `/status` — Overview of spec health, section counts, and coverage
- `/validate` — XSD schema validation
- `/score` — Multi-dimensional quality rating (completeness, traceability, quality, structure, consistency)
