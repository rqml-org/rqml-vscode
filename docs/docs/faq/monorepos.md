---
sidebar_position: 1
---

# Monorepos

How RQML works with monorepos, multi-package repositories, and multi-root VS Code workspaces.

## One spec per project unit

RQML enforces **exactly one requirements spec per project unit**. A "project unit" is a package, app, or service directory inside your repository — not necessarily the git repo root.

```
my-monorepo/
├── packages/
│   ├── api/
│   │   ├── requirements.rqml   ← spec for the API package
│   │   └── src/
│   ├── web/
│   │   ├── requirements.rqml   ← spec for the web app
│   │   └── src/
│   └── shared/
│       └── src/                 ← no spec — "No RQML project detected"
└── package.json
```

There is no repo-root "umbrella spec". Each unit is independent.

## Naming convention

- **`requirements.rqml`** is the preferred filename. The extension looks for it first.
- If `requirements.rqml` is not present, the extension falls back to any single `*.rqml` file in the directory.
- If a directory contains **multiple** `*.rqml` files and none is named `requirements.rqml`, the extension treats it as **ambiguous** and shows an error with quick-fix actions:
  - "Choose primary spec" — pick which file to use
  - "Rename to requirements.rqml" — rename the chosen file

## How project resolution works

When you open or switch to a file, the extension resolves which RQML project it belongs to:

1. Start at the active file's directory.
2. Walk **upward** toward the workspace root.
3. In each directory, check (in order):
   - `requirements.rqml` — if found, this directory is the project root.
   - Any single `*.rqml` file — if exactly one exists, this directory is the project root.
4. The **first directory that matches** wins.
5. If no match is found by the time the workspace root is reached, the project is **undefined** ("No RQML project detected").

### Nearest wins

If specs exist at multiple levels (e.g., both `/repo/packages/api/requirements.rqml` and `/repo/requirements.rqml`), the **nearest** spec to the active file takes precedence.

## Automatic context switching

When you switch between files in different monorepo units, the extension **automatically switches project context**:

- The sidebar (tree view, details, traces) updates to reflect the new unit's spec.
- The status bar updates to show the new project root and spec path.
- The agent panel operates against the new unit's spec.
- Validation diagnostics are scoped to the active unit.

## Multi-root workspaces

In VS Code multi-root workspaces, each workspace folder is treated as an independent root boundary. The upward directory walk **never crosses** workspace folder boundaries.

```
Multi-root workspace:
  Folder A: /path/to/project-a    ← independent boundary
  Folder B: /path/to/project-b    ← independent boundary
```

A file in Folder B will never resolve to a spec in Folder A, even if Folder A has one.

## Traceability scope

Traceability views, graphs, and requirement-to-test matrices operate **within the resolved unit's single spec**. Cross-unit traceability is not supported.

## No RQML project detected

If the extension cannot resolve a project for the active file, it shows:

- A "No RQML project detected" status in the status bar.
- Call-to-action buttons in the sidebar:
  - **"Create requirements.rqml here…"** — creates a new spec in the active file's directory.
  - **"Locate existing spec…"** — opens a file picker to select an existing `.rqml` file.
