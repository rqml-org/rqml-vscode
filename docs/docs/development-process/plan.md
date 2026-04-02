---
sidebar_position: 4
---

# Stage 3: Plan

The third stage is to break the work into **actionable steps**. The output is a staged implementation plan stored at `.rqml/plan.md` — a markdown document structured for AI coding agents, with each stage framed as a self-contained task.

## The `/plan` command

```
/plan
/plan --full
/plan <REQ-ID | PKG-ID>
```

### Modes

| Invocation | Behaviour |
|---|---|
| `/plan` | Review the existing plan and propose the next step |
| `/plan --full` | Generate or regenerate the entire plan from scratch |
| `/plan <target>` | Scope the plan to a specific requirement or package |

### How it works

The agent analyses your spec (and existing ADRs) to produce a staged implementation plan where each stage includes:

- **Goal** — What this stage accomplishes
- **Input requirements** — Which spec requirements (by ID) this stage addresses
- **Files to create or modify** — Concrete file paths
- **Acceptance criteria** — How to verify the stage is complete
- **Verification commands** — Tests, build, or lint commands to run
- **Trace expectations** — Which trace edges should be added

### Review vs. regenerate

- Without `--full`, the agent **reviews** the existing plan: it summarizes progress (which stages are done), identifies the next stage, and proposes what it will involve. The plan file is not overwritten.
- With `--full`, the agent **regenerates** the plan. If a plan already exists, completed stages (marked `[x]`) are preserved.

### Readiness verdict

Every plan starts with a readiness assessment:

- **READY** — The spec is sufficient to begin implementation
- **NOT READY** — There are blocking issues (listed with recommended fixes)

If the spec is not ready, the agent will suggest returning to the Spec or Design stage to address the gaps before planning.

## The plan file

The plan is persisted to `.rqml/plan.md`:

```
project/
├── requirements.rqml
└── .rqml/
    ├── adr/
    └── plan.md  ← the plan
```

The file uses markdown with checkboxes to track completion:

```markdown
## Stage 1: Project scaffolding
- [x] Goal: Set up project structure and build tooling
- [x] Requirements: REQ-UI-001, REQ-UI-002
- [x] Verification: `npm run build` passes

## Stage 2: Authentication
- [ ] Goal: Implement auth middleware and login flow
- [ ] Requirements: REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003
- [ ] Verification: `npm test -- --grep auth` passes
```

The agent reads this file automatically when building context for `/implement` and `/cmd`, so it always knows where you left off.

## Framed for coding agents

Unlike traditional project plans that estimate human time, RQML plans are designed for **AI coding agents**. Each stage is described as an agent task:

- What the agent should do
- Which files and modules it should touch
- What inputs it needs (spec sections, existing code, ADRs)
- How to verify the output (tests, build, lint)

This makes the plan directly usable by `/cmd` (to generate agent prompts) and `/implement` (to execute stages autonomously).
