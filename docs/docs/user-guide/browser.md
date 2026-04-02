---
sidebar_position: 2
---

# RQML Browser

The RQML Browser is the sidebar that appears when you click the RQML icon in the Activity Bar. It provides a structured view of your specification split into three resizable regions.

![RQML Browser](/img/screenshots/RQML-overview-and-language-mode.png)

## Overview (top)

The Overview region displays a tree view of the entire RQML specification. Every RQML section is shown — including sections that are not yet defined in your spec, which appear with dimmed styling and a "(not defined)" label.

**Tree structure:**

```
RQML Spec
├── Metadata
├── Goals
│   ├── GOAL-SE-PRINCIPLES: Preserve software engineering rigor
│   └── GOAL-LLM-CONTEXT: Maintain LLM coding context
├── Requirements
│   ├── PKG-UI: VS Code UI surfaces
│   │   ├── REQ-UI-001: Activity Bar icon
│   │   ├── REQ-UI-002: Open RQML overview
│   │   └── ...
│   └── PKG-AUTH: Authentication
├── Scenarios (not defined)
├── Test Cases (not defined)
└── Traceability
```

### Toolbar actions

The Overview title bar includes action icons for opening additional views:

| Icon | Action | Description |
|---|---|---|
| Document | Open Document View | Rendered, readable view of the full spec |
| Bar chart | Open Trace Graph | Interactive traceability visualization |
| Grid | Open Matrix View | Requirements-to-tests coverage matrix |
| Arrow | Open Trace View | Trace graph of relationships |
| Export | Export Spec | Open the export wizard |

### Context menu

Right-clicking items in the tree provides:

- **Go to Definition** — Jump to the item's location in the `.rqml` source file
- **Rename** — Rename an item's title
- **Delete** — Remove an item from the spec
- **Add Item** — Add a new item to a section

## Details (middle)

The Details region shows properties and metadata for whichever item is currently selected in the tree. For a requirement, this includes:

- Requirement ID, type, status, and priority
- The requirement statement text
- Acceptance criteria (given/when/then blocks)
- Notes and rationale
- Source location in the `.rqml` file

## Traces (bottom)

The Traces region lists all trace edges that the selected item participates in — both incoming and outgoing. Each trace shows:

- The linked item ID (clickable — navigates to that item and syncs all three views)
- The trace type: `dependsOn`, `refines`, `satisfies`, `constrains`
- Any notes attached to the trace edge

This makes it easy to follow the chain of reasoning from high-level goals down to specific requirements and their dependencies.

## Empty state

When no `.rqml` file is found in the workspace, the browser shows an info message and a "Create RQML Spec" action that launches the init wizard.
