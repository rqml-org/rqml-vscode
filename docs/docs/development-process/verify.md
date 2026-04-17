---
sidebar_position: 6
---

# Stage 5: Verify

The fifth stage is to **confirm** that the code, tests, and design satisfy the spec and remain fully traceable. The output is a trace graph in the RQML spec document — verified coverage from goals through requirements to implementation and tests.

## What verification covers

| Check | Question answered |
|---|---|
| **Coverage** | Does every requirement have an implementation and verification evidence? |
| **Traceability** | Are trace edges complete and pointing at real, current artifacts? |
| **Consistency** | Does the code still match what the spec says? Has either drifted? |
| **Quality** | Is the spec itself well-formed, testable, and free of ambiguities? |

## The `/sync` command

```
/sync
/sync status
/sync scan
```

Checks synchronisation between the spec and the codebase. It identifies:

- Requirements with no code references
- Code paths with no corresponding requirement
- Stale tests versus acceptance criteria
- Changed code hotspots since the last spec update

| Subcommand | Description |
|---|---|
| `status` | Quick local trace summary — edge counts, untraced requirements (default) |
| `scan` | Deep LLM-based sync scan identifying drift between spec and code |

Use `/sync status` as the fast first check and `/sync scan` when you need a thorough analysis.

## The `/lint` command

```
/lint
```

Runs semantic quality checks on the spec itself and reports issues such as:

- Vague language ("should support", "as needed") without measurable criteria
- Non-atomic requirements that combine multiple concerns
- Untestable acceptance criteria
- Missing trace links for requirements that should have them
- Orphan items with no incoming or outgoing traces
- Naming violations against the RQML ID conventions

Lint flags quality problems that may not be schema-invalid but undermine the spec's usefulness as a source of truth.

## Other verification tools

The following commands complement `/sync` and `/lint` during the Verify stage:

| Command | Purpose |
|---|---|
| `/status [--full]` | Overall spec health summary — counts, coverage, readiness |
| `/validate` | XML well-formedness and XSD schema validation |
| `/score [--full]` | Multi-dimensional quality rating (1–10 across each dimension) |
| `/trace <REQ-ID>` | Show all incoming and outgoing trace edges for a requirement |
| `/diff` | Compare the spec against implementation and report coverage |

## When to verify

Run the verify stage:

- **After completing a plan stage** — catch missing traces or drift early
- **Before merging a pull request** — ensure the branch is still spec-compliant
- **Before a release** — confirm full coverage and no outstanding gaps
- **Periodically during long-running work** — drift compounds silently if left unchecked

## The iterative cycle

Verification often reveals the need to return to an earlier stage:

- **Missing requirements?** Return to `/elicit`
- **Design decisions not captured?** Use `/design new`
- **Plan out of date?** Run `/plan --full`
- **Code lagging behind spec?** Use `/implement`

The five stages form a cycle, not a one-way pipeline — each verification pass sharpens the next iteration.
