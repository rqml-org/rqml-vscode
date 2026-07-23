# ADR-0006: What the editor can enforce, and what it must only report

- **Status**: Accepted
- **Date**: 2026-07-23
- **Classification**: `required_by_spec`
- **Related requirements**: `REQ-GATE-001`..`REQ-GATE-006`
- **Related ADRs**: `ADR-0005` (oversight surface), `ADR-0008` (engine dependency boundary)
- **Affected components**: `src/services/` (a future gate service), `src/services/implementTools.ts`, `src/services/agentService.ts`, `README.md`

## Context

The sibling RQML integrations converged on a three-layer enforcement model: a
best-effort pre-edit block, an authoritative turn-end `rqml check`, and CI as
the unconditional backstop. `ADR-0005` makes the editor the surface where a
human watches what an agent did, so the obvious next question is how much of
that model a VS Code extension can actually implement.

The answer is: less than it looks, and the gap matters because the product's
entire proposition is that it tells the truth about whether code and
specification agree. A gate that is advertised as blocking, but does not,
is worse than no gate — it converts a real signal into a false assurance.

What a VS Code extension genuinely controls is narrow. It controls the writes
it makes itself, which in this codebase means the agent's own file-writing
tool. Everything else — the user typing in the editor, another extension's
edits, an agent running in the integrated terminal, GitHub Copilot in agent
mode — happens outside any interception point the extension can install.

The editor APIs that look like veto points are not. `onWillSaveTextDocument`
and the file-operation participation events accept a `waitUntil` that can
contribute additional edits or delay the operation; neither can cancel it.
`FileSystemProvider` is registered per URI scheme, so it does not see writes to
ordinary workspace files. There is no event that fires before another
extension's language-model tool is invoked. The proposal that would have
allowed programmatic resolution of tool approvals, microsoft/vscode#302362, was
closed as not planned. *(Verified against the VS Code API surface the extension
compiles against; re-check when raising the `engines.vscode` floor.)*

## Decision drivers

- The editor's verdict must never disagree with the build's verdict.
- No user-facing surface may imply enforcement the extension cannot deliver.
- The one thing the extension *can* block reliably is its own agent's writes.
- Enforcement that changes the behaviour of a tool people already use should
  not arrive switched on in an update they did not ask for.

## Options considered

1. **Advertise a workspace-wide gate.** Rejected outright: it cannot be
   implemented, and claiming it would be a false assurance about the single
   thing the product exists to provide.
2. **Attempt a best-effort block via save participation and diagnostics.**
   Rejected: `waitUntil` cannot cancel a save, so the block would fail silently
   and unpredictably — the worst of both worlds, since users would believe a
   gate existed and it would sometimes not fire.
3. **Ship no enforcement; surface the verdict only.** Attractive for honesty,
   but discards the one enforcement that is both reliable and meaningful.
4. **Enforce exactly what is controllable; report everything else; name the
   boundary.** Chosen.

## Decision

The extension implements enforcement in three tiers, and states which is which.

**Blocked.** Writes made by the extension's own agent to a file that a trace
edge links to a non-approved requirement are refused (`REQ-GATE-005`). This is
reliable because the extension owns the call site. It is governed by the
resolved strictness level and is **disabled by default**, because enabling it
changes the behaviour of a tool users already depend on.

**Reported.** Everything else. Edits by the user, by another extension, or by
an agent outside the extension produce diagnostics and a status-bar verdict
(`REQ-GATE-003`), and nothing more. The verdict is computed from `@rqml/core`
alone, composed exactly as `rqml check` composes it (`REQ-GATE-001`), with no
language model anywhere in that path (`REQ-GATE-002`).

**Unconditional.** `rqml check` in continuous integration. It is the only layer
that cannot be bypassed by choosing a different tool, and it is where the
project's actual guarantee lives.

`REQ-GATE-006` makes the disclosure itself a requirement: the README and the
settings that control the gate must say which edits are blocked, which are only
reported, and that CI is the authoritative gate.

## Consequences

**Positive**
- The editor's claims match its capabilities, so the verdict stays trustworthy.
- The verdict surface — the tier that carries the strategic value — has no
  dependency on the enforcement tier, and can ship first and alone.
- Being explicit that CI is authoritative pushes users toward the layer that
  actually protects them.

**Negative**
- Users may reasonably expect an extension called an enforcement layer to
  prevent edits, and will find that it mostly does not. The documentation has
  to carry that expectation-setting on every surface, repeatedly.
- The blocked tier only covers the agent that `ADR-0005` froze, so its
  practical reach shrinks as users move to other agents. Its value is
  demonstrating the primitive, not carrying the product.
- Reaching further — into other agents' edits — requires the extension to
  contribute tools or an MCP server that those agents call, which is a
  different integration and is deliberately out of scope here.

## Supersession

None. This ADR is current. If a future VS Code release introduces a genuine
veto point for file operations or tool invocations, supersede this record
rather than quietly widening what the extension claims.
