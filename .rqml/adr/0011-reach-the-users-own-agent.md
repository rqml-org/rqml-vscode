# ADR-0011: Reach the user's own agent through MCP and a minimal tool set

- **Status**: Accepted
- **Date**: 2026-07-23
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-GATE-001`, `REQ-GATE-006`
- **Related ADRs**: `ADR-0005` (oversight surface, agent freeze), `ADR-0006` (enforcement boundary), `ADR-0008` (engine dependency boundary)
- **Affected components**: `src/services/mcpProvider.ts`, `src/services/lmTools.ts`, `package.json`

## Context

`ADR-0005` froze this extension's bespoke agent, on the grounds that it competes
with tools the user already has and that VS Code is narrowing extension
participation in AI toward contributed tools, MCP servers and agents. That ADR
answered what the extension should stop doing. It did not answer what takes its
place.

`ADR-0006` drew the enforcement boundary: the extension can block only its own
agent's writes, everything else is reported, and CI is the authoritative gate.
It also named the way out — "reaching further, into other agents' edits,
requires the extension to contribute tools or an MCP server that those agents
call" — and deferred that as a separate integration. This is that integration.

The practical gap is concrete. A user running GitHub Copilot agent mode or
Claude Code in the terminal gets nothing from this extension except a status
bar and some views. The engine that computes the verdict, the coverage, the
drift and the impact analysis is right there in the process, and their agent
cannot reach any of it.

## Decision drivers

- The agent a user already trusts is the one worth equipping; a second agent in
  a panel is the thing `ADR-0005` froze.
- `@rqml/mcp` already exposes the whole engine — thirteen tools covering check,
  show, link, impact, matrix, approve and the rest. Re-implementing any of that
  as extension tools would be duplication with a worse user experience.
- Every extension-contributed tool invocation shows the user a confirmation
  dialog that the extension cannot suppress. Tools are therefore not free, and
  a large contributed set would be actively unpleasant.
- Whatever is contributed must not imply enforcement the extension cannot
  deliver (`REQ-GATE-006`).

## Options considered

1. **Contribute every RQML operation as a language model tool.** Rejected: it
   duplicates the MCP server, and each duplicate costs a confirmation dialog,
   so the same question becomes more expensive to ask, not less.
2. **Build a chat participant.** The API is stable, but a participant owns the
   conversation and extends ask mode — the bespoke-agent shape `ADR-0005`
   froze, rebuilt on a different API. Rejected.
3. **Register the MCP server, and contribute only what a separate process
   cannot see.** Chosen.

## Decision

**The extension registers `@rqml/mcp` for the user**, through
`contributes.mcpServerDefinitionProviders` and
`lm.registerMcpServerDefinitionProvider`. The server is offered with its working
directory set to the governing specification's own unit root — the same
directory the gate uses as its `baseDir` — so in a monorepo the agent's tools
and the editor's verdict are scoped to the same unit. The provider re-fires when
the governing specification changes, so moving between units follows the user.

The server version is **pinned**, not floating. `ADR-0008` keeps the editor's
verdict consistent by depending on `@rqml/core` directly; an MCP server running
a different engine version could answer a question differently from the status
bar, which is the disagreement `ADR-0006` forbids. Pinning makes that skew a
deliberate upgrade.

**Two language model tools are contributed, and only two.** The bar is that a
tool must be impossible from the MCP server, because it needs an editor handle
or editor-only state:

- `rqml_editor_context` — which specification governs the workspace and the open
  file, the resolved strictness, whether the workspace holds several
  specifications or ambiguous directories, the cursor position, and the last
  gate verdict. A separate process cannot see any of this.
- `rqml_check_unsaved` — the gate verdict for the **unsaved** editor buffer.
  `rqml_check` reads the file from disk, so while an agent is editing a
  specification its answer describes a file that no longer reflects the work.

Everything else the engine offers is left to MCP. In particular the extension
does **not** contribute `rqml_check`, `rqml_show`, `rqml_link`, `rqml_validate`,
`rqml_trace`, `rqml_impact`, `rqml_status`, `rqml_matrix`, `rqml_overview`,
`rqml_skeleton`, `rqml_approve` or `rqml_discover`.

**No engine floor change.** Both APIs are stable well below the manifest's
existing `^1.108.1`: the Language Model Tools API was finalized in 1.95, and
`registerMcpServerDefinitionProvider` in 1.101. Both are present in the
`@types/vscode` the extension already compiles against. The floor stays where it
is, and `@types/vscode` stays capped at it.

**This changes nothing about enforcement.** Neither tool can block anything, and
`ADR-0006` stands unamended: the whole Language Model Tools interface is
`invoke` and `prepareInvocation`, with no hook that fires before another tool
runs. Contributing tools makes the extension's knowledge reachable; it does not
make the extension a gate over another agent.

## Consequences

**Positive**
- A user's own agent gets the entire RQML loop, from the specification that
  actually governs the file they are editing.
- The two contributed tools cover the seam a separate process cannot: editor
  state, and unsaved work.
- The bespoke agent becomes genuinely optional rather than the only way to get
  agent-assisted RQML work, which is what `ADR-0005` needed to be true.

**Negative**
- The user sees a trust prompt the first time the MCP server starts, and the
  extension cannot pre-trust it. "Zero configuration" is accurate for setup but
  not for consent.
- `npx -y @rqml/mcp@…` fetches from the network on first use, so the MCP tools —
  unlike the editor's own verdict — are not available offline until npm has
  cached the package. The editor's verdict deliberately has no such dependency.
- The pinned server version must be advanced by hand alongside `@rqml/core`, and
  nothing enforces that they match. A drift there reintroduces exactly the skew
  this pin exists to prevent.
- Contributed tools are, by default, available only in chats in the window where
  the extension is running, so the reach is narrower than the MCP server's.

## Supersession

None. This ADR is current. If VS Code introduces a way for an extension to
register an agent hook programmatically, the enforcement question reopens — that
would be a supersession of `ADR-0006`, and this record should be revisited with
it.
