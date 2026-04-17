---
sidebar_position: 5
---

# Stage 4: Code

The fourth stage is to **implement** the requirements, keeping the spec and code in sync. RQML provides two approaches: generating prompts for external coding agents, or running an integrated agentic implementation loop.

## The `/cmd` command

Generate a concise, copy-pasteable prompt for an external coding agent.

```
/cmd
/cmd next
/cmd all
/cmd next <REQ-ID | PKG-ID>
```

| Subcommand | Description |
|---|---|
| `next` | Generate a prompt for the next unimplemented plan stage (default) |
| `all` | Generate prompts for all remaining stages |
| `next <target>` | Generate a prompt scoped to a specific requirement or package |

### How it works

The agent reads the spec, ADRs, and plan, then produces a high-level reference prompt — no code snippets, just a clear description of what to implement, which files to touch, and how to verify the result. The output is suitable for pasting into:

- Claude Code
- GitHub Copilot Chat
- Cursor
- Any other coding agent or LLM interface

Use the **Copy to clipboard** link that appears after the prompt is generated.

## The `/implement` command

Run an integrated, multi-step implementation loop directly in the RQML agent.

```
/implement
/implement <REQ-ID | PKG-ID>
```

### How it works

The agent enters an agentic tool loop where it:

1. **Reads** the spec, plan, and ADRs to determine the next stage
2. **Reads** existing files to understand the codebase
3. **Proposes** file changes (creates or modifies files)
4. **Waits for approval** — you see the proposed content and confirm each write
5. **Updates the spec** — adds trace edges linking requirements to source files
6. **Updates the plan** — marks the completed stage with `[x]`

![Agent requesting implementation confirmation](/img/screenshots/RQML-agent-implement-confirm.png)

### Available tools

During `/implement`, the agent has access to:

| Tool | Approval required | Description |
|---|---|---|
| `readFile` | No | Read a file from the workspace |
| `writeFile` | **Yes** | Write or create a file |
| `listFiles` | No | List files matching a glob pattern |
| `readSpec` | No | Read the current RQML spec |
| `updateSpec` | **Yes** | Update the RQML spec file |
| `askUser` | — | Present the user with a question and clickable options |

### One stage at a time

The agent implements **one plan stage per invocation**. After completing a stage, it updates the plan and stops. Run `/implement` again to proceed to the next stage, or specify a target to jump to a specific requirement.

![Agent executing a plan stage](/img/screenshots/RQML-agent-plan-implementation.png)

## Next: verify

Once implementation is complete, move on to the [Verify stage](./verify.md) to confirm coverage, traceability, and spec-code consistency.
