---
sidebar_position: 1
---

# Development Process

RQML enforces a five-stage development process that keeps requirements, design, planning, code, and verification in sync. Every stage produces a concrete artifact, and the RQML agent provides slash commands to guide you through each one.

![RQML Development Process](/img/screenshots/RQML-development-process.png)

| Stage | Task | Output | Slash commands |
|---|---|---|---|
| **Spec** | Document your intent in a detailed requirements specification | `.rqml` file | `/elicit` |
| **Design** | Decide system architecture and document design decisions | ADRs in `.rqml/adr/` | `/design` |
| **Plan** | Create a multi-step implementation plan geared towards coding agents | Plan in `.rqml/plan.md` | `/plan` |
| **Code** | Implement the requirements, keeping the spec and code in sync | Working code and tests | `/cmd`, `/implement` |
| **Verify** | Confirm that code, tests, and design satisfy the spec and remain fully traceable | Trace graph in RQML spec document | `/sync`, `/lint` |

The agent always nudges you towards this workflow. If you try to jump ahead — for example, asking to implement a feature that isn't in the spec — the agent will redirect you to the appropriate stage first.

## The `.rqml/` directory

Each stage produces files that live alongside your spec:

```
project/
├── requirements.rqml              ← the spec
├── .rqml/
│   ├── adr/                       ← architecture decision records
│   │   ├── 0001-auth-strategy.md
│   │   ├── 0002-api-versioning.md
│   │   └── 0003-database-choice.md
│   └── plan.md                    ← the implementation plan
└── src/
```

In monorepo setups, each spec gets its own `.rqml/` directory, co-located with that spec file.

## Enforcement and strictness

How strictly the agent enforces this process depends on the strictness level:

| Strictness | Behaviour |
|---|---|
| `relaxed` | Suggests the process but allows shortcuts |
| `standard` | Requires spec-first for features, core traces required |
| `strict` | Full traceability, all behaviour must be specified |
| `certified` | Audit-grade, formal approval required at each stage |
