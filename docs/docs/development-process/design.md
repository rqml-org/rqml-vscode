---
sidebar_position: 3
---

# Stage 2: Design

The second stage is to decide **how** you will build it. The output is a set of Architecture Decision Records (ADRs) stored in `.rqml/adr/` — structured documents that capture significant design decisions, the options considered, and the rationale for the chosen approach.

## The `/design` command

```
/design [new|review|decide|overview|list] [<topic | ADR-ID>]
```

### Modes

| Subcommand | Description |
|---|---|
| `/design new <topic>` | Start a new design decision |
| `/design review <ADR>` | Revisit an existing ADR in light of new information |
| `/design decide <ADR>` | Finalize a proposed ADR (set status to Accepted) |
| `/design overview` | Summarize current architecture from the ADR set |
| `/design list` | List existing ADRs with status, classification, and date |
| `/design` | Infer intent from context (overview if ADRs exist, help if none) |

### Starting a new decision

When you run `/design new <topic>`, the agent:

1. **Classifies** the decision (see [classification model](#classification-model) below)
2. **Assesses ADR-worthiness** — is this significant enough to record?
3. **Explores options** with pros and cons for each
4. **Recommends** a decision
5. **Saves** the ADR to `.rqml/adr/` if the decision is ADR-worthy

If the topic is not ADR-worthy (e.g., a minor implementation detail), the agent still helps reason about it but explicitly states that no ADR is created.

### Looking up ADRs

The `review` and `decide` subcommands accept an ADR reference by:

- **Number:** `1`, `0001`, or `ADR-0001`
- **Keyword:** any word from the filename slug (e.g., `auth`, `monorepo`)

## ADR files

ADRs are stored in `.rqml/adr/` alongside the spec file:

```
project/
├── requirements.rqml
└── .rqml/
    └── adr/
        ├── 0001-auth-strategy.md
        ├── 0002-api-versioning.md
        └── 0003-database-choice.md
```

### Naming convention

Filenames use a zero-padded four-digit number followed by a kebab-case slug:

```
NNNN-kebab-case-slug.md
```

Examples:
- `0001-auth-strategy.md`
- `0002-api-versioning.md`
- `0003-monorepo-handling.md`

Numbers are sequential and monotonically increasing. The agent determines the next number by scanning the existing directory.

### ADR template

Every ADR follows a standard template:

```markdown
# ADR-0001: Short decision title

- Status: Accepted
- Date: 2026-04-02
- Classification: discretionary_design_choice
- Related requirements: REQ-AUTH-001, REQ-AUTH-003
- Related ADRs: None
- Affected components: auth service, middleware

## Context
Why this decision is needed.

## Decision drivers
The main forces behind the decision.

## Options considered

### Option 1: JWT tokens
Description, pros, and cons.

### Option 2: Session cookies
Description, pros, and cons.

## Decision
The chosen option and why.

## Consequences
Positive and negative consequences of the decision.

## Supersession
None (or reference to superseded/superseding ADR)
```

## Classification model

Every design issue handled by `/design` is classified into one of four categories:

| Classification | Meaning | Creates ADR? |
|---|---|---|
| `required_by_spec` | Directly mandated by RQML/spec rules | Yes |
| `derived_from_requirements` | Effectively forced by requirements or constraints | Yes |
| `discretionary_design_choice` | Real design choice with multiple viable alternatives | Yes |
| `implementation_detail` | Too low-level for architectural significance | No |

The classification appears in the agent's reasoning and in the ADR itself.

### When is a decision ADR-worthy?

A decision warrants an ADR when at least some of the following are true:

- There are multiple plausible options
- The choice affects architecture, workflow, or system behavior
- The choice is likely to matter later or constrains future work
- The choice affects more than one component
- The choice is not already trivially mandated by existing rules

## ADR lifecycle

ADRs support five statuses:

| Status | Meaning |
|---|---|
| **Proposed** | Drafted but not yet finalized |
| **Accepted** | Decision made and in effect |
| **Superseded** | Replaced by a newer ADR |
| **Deprecated** | No longer relevant but preserved for history |
| **Rejected** | Considered but not adopted |

### Default status

- When `/design new` concludes with a clear decision, the ADR is saved as **Accepted**.
- If you want to draft without finalizing, the ADR is saved as **Proposed**. Use `/design decide` later to accept it.

### Superseding a decision

When a new decision replaces an old one:

1. The old ADR is marked **Superseded** with a reference to the new ADR
2. A new ADR is created with the updated decision
3. The old ADR is never deleted — history is preserved

Use `/design review <ADR>` to revisit a decision and determine whether supersession is warranted.

## Introduction to ADRs

An **Architecture Decision Record** (ADR) is a short document that captures a single design decision — the context that motivated it, the options that were considered, and the rationale for the choice that was made. The format was first proposed by Michael Nygard and has since become a widely adopted practice in software engineering teams.

### Why ADRs?

Design decisions are some of the hardest things to reconstruct after the fact. Code shows *what* was built, tests show *what works*, but neither explains *why this approach was chosen over the alternatives*. ADRs fill that gap.

Without ADRs, design rationale lives in Slack threads, meeting notes, and the memories of whoever was in the room — all of which decay quickly. With ADRs, every significant decision has a durable, searchable record.

### Why ADRs fit RQML

RQML is built around the principle that **intent should be documented before implementation**. The spec captures *what* the system should do; ADRs capture *how* it should be built and why.

Together, they form a complete chain of reasoning:

1. **Requirements** (`.rqml`) define the problem and acceptance criteria
2. **ADRs** (`.rqml/adr/`) document the architectural choices made to satisfy those requirements
3. **The plan** (`.rqml/plan.md`) breaks those choices into implementable stages
4. **Code** implements the plan, traceable back to requirements and design decisions

ADRs also make the Design stage explicit. Without them, teams often jump from requirements straight to code — skipping the deliberate evaluation of alternatives that prevents costly rework later.

### ADRs and LLM coding agents

ADRs are particularly valuable when working with LLM coding agents. An agent that has access to your ADRs understands not just *what* to build (from the spec) but *how* to build it (from the design decisions). This reduces hallucination, prevents the agent from making architectural choices that contradict your intent, and keeps generated code consistent across sessions.

The RQML agent automatically includes ADR summaries in its context when running `/plan`, `/cmd`, and `/implement`, so your design decisions are always respected during implementation.

## Monorepo support

In monorepo setups with multiple RQML specs, each spec has its own `.rqml/` directory and its own set of ADRs:

```
monorepo/
├── packages/
│   ├── api/
│   │   ├── requirements.rqml
│   │   └── .rqml/adr/            ← ADRs for the API package
│   └── web/
│       ├── requirements.rqml
│       └── .rqml/adr/            ← ADRs for the web app
```
