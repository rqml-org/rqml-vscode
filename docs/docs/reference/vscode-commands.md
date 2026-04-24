---
sidebar_position: 2
---

# VS Code Commands

All commands registered by the RQML extension are accessible via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`). Type "RQML" to filter to RQML commands.

---

## Spec Management

### RQML: Init Spec

`rqml-vscode.initSpec`

Create a new `requirements.rqml` file in the current project root using the latest available XSD schema version.

### RQML: Open Settings

`rqml-vscode.openSettings`

Open the RQML extension settings view.

---

## Provider & Model Management

The extension uses a curated catalog of providers and models. Providers are singletons — one API key per provider. Keys are resolved from VS Code Secret Storage first, then from environment variables (e.g. `OPENAI_API_KEY`). See the [RQML Agent user guide](../user-guide/agent.md#providers-and-keys) for the full list of supported providers and their env vars.

### RQML: Add LLM Provider

`rqml-vscode.addLlmProvider`

Pick a provider from the catalog and supply an API key. If a matching environment variable is already set, you can accept it without entering the key manually.

### RQML: Remove LLM Provider

`rqml-vscode.removeLlmProvider`

Delete a provider's stored API key. If the removed provider owned the active model, the active model is cleared. Keys sourced from environment variables cannot be removed this way — unset the env var instead.

### RQML: Select Model

`rqml-vscode.selectModel`

Open the model picker to choose the active model. All models from providers with an available key (stored or env var) are shown, grouped by provider. Selecting a model from a different provider automatically switches the active provider.

### RQML: List Models

`rqml-vscode.slashModels`

Dispatches `/models` to the agent panel — lists available models grouped by provider.

### RQML: Test Model

`rqml-vscode.slashModelTest`

Dispatches `/model test` to the agent panel — runs a lightweight connectivity check against the active model.

---

## Sidebar Tree View

These commands operate on items in the RQML sidebar tree view.

### Open RQML Document

`rqml-vscode.openDocumentView`

Open a WYSIWYG document view of the full spec with chapters for each RQML section.

**Available from:** view title bar icon, root node context menu

### Open Traceability Map

`rqml-vscode.openTraceView`

Open a visual traceability map showing relationships between requirements.

**Available from:** view title bar icon, root node context menu

### Open Requirements Grid

`rqml-vscode.openGridView`

Open a requirements-to-test-cases matrix with status colouring.

**Available from:** view title bar icon, root node context menu

### Open RQML Ideas

`rqml-vscode.openIdeasView`

Open an LLM-assisted view for brainstorming spec improvements and new features.

**Available from:** view title bar icon, root node context menu

### Add RQML Item

`rqml-vscode.addItem`

Create a new item within a section of the spec.

**Available from:** hover icon on section nodes in the tree view

### Rename

`rqml-vscode.renameItem`

Rename the selected item in the tree view.

**Available from:** right-click context menu on items

### Delete

`rqml-vscode.deleteItem`

Delete the selected item from the spec.

**Available from:** right-click context menu on items

### Go to Definition

`rqml-vscode.gotoDefinition`

Navigate to the selected item's definition in the RQML source file, opening the file in the editor if needed.

**Available from:** right-click context menu on items

### Export Spec...

`rqml-vscode.export`

Export the RQML spec to HTML, PDF, Markdown, or Word format.

**Available from:** right-click context menu on the root "RQML Spec" node

---

## Agent Slash Commands (Palette Access)

These commands dispatch slash commands to the RQML agent panel. If the agent panel is not visible, it is opened automatically. See the [Slash Commands](./slash-commands.md) reference for detailed usage.

| Command Palette Title | Command ID | Dispatches |
|---|---|---|
| RQML: Help (Agent Commands) | `rqml-vscode.slashHelp` | `/help` |
| RQML: About | `rqml-vscode.slashAbout` | `/about` |
| RQML: Status | `rqml-vscode.slashStatus` | `/status` |
| RQML: Status (Full Assessment) | `rqml-vscode.slashStatusFull` | `/status --full` |
| RQML: Validate Spec | `rqml-vscode.slashValidate` | `/validate` |
| RQML: Lint Spec | `rqml-vscode.slashLint` | `/lint` |
| RQML: Score Spec | `rqml-vscode.slashScore` | `/score` |
| RQML: Sync Status | `rqml-vscode.slashSync` | `/sync` |
| RQML: Sync Scan (Deep) | `rqml-vscode.slashSyncScan` | `/sync scan` |
| RQML: Plan Implementation | `rqml-vscode.slashPlan` | `/plan` |
| RQML: Implement Next Stage | `rqml-vscode.slashImplement` | `/implement` |
| RQML: Elicit Requirements | `rqml-vscode.slashElicit` | `/elicit` |
| RQML: List Providers | `rqml-vscode.slashProviders` | `/providers` |
| RQML: LLM Status | `rqml-vscode.slashLlm` | `/llm` |
| RQML: Doctor (Health Check) | `rqml-vscode.slashDoctor` | `/doctor` |

---

## Context Menus

Right-clicking items in the RQML sidebar tree view exposes context-sensitive actions:

| Node Type | Available Actions |
|---|---|
| Root node ("RQML Spec") | Open Document, Open Trace Map, Open Grid, Open Ideas, Export Spec |
| Section node | Add Item |
| Missing section node | Add Item |
| Item node | Go to Definition, Rename, Delete |

The four view commands (Document, Trace, Grid, Ideas) also appear as icons in the view title bar.
