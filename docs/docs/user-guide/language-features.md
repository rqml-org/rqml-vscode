---
sidebar_position: 3
---

# Language Features

The RQML extension provides language support for `.rqml` files and several additional views for visualizing your specification.

## Spec XML view

RQML files are XML documents. The extension registers `.rqml` as a language mode with:

- **Syntax highlighting** — RQML elements, attributes, and values are color-coded using a TextMate grammar
- **Real-time validation** — XML well-formedness, XSD schema conformance, and semantic rules are checked as you type, with diagnostics appearing in the Problems panel
- **Go to Definition** — Navigate from the tree view to the exact line in the source file

![RQML editing and overview](/img/screenshots/RQML-overview-and-language-mode.png)

The status bar shows the current spec status: whether the spec is loaded, valid, and whether XSD validation is active.

## Spec Document view

The Document view renders your RQML spec as a readable, navigable HTML document — similar to a traditional requirements specification document. Open it from the document icon in the Overview toolbar.

![Document and matrix views](/img/screenshots/RQML-doc-and-matrix-views.png)

The document view:

- Organizes content into chapters by RQML section (Goals, Requirements, Scenarios, etc.)
- Displays each item with its full properties, acceptance criteria, and notes
- Updates automatically when the spec file changes
- Supports navigation — clicking items scrolls to their location

This view is useful for reviewing the spec in a human-friendly format without reading raw XML, and for sharing with stakeholders who are not familiar with the RQML markup.

## Requirements Matrix view

The Matrix view (also called Grid view) shows a cross-reference matrix of requirements against test cases and verification items. Open it from the grid icon in the Overview toolbar.

The matrix view:

- Displays requirements along one axis and verification items along the other
- Uses color-coded cells to indicate coverage status
- Highlights requirements with no verification and tests with no linked requirement
- Supports clicking cells to navigate to the source items

This view is designed for coverage discussions — quickly identifying which requirements have tests, which don't, and where verification gaps exist.

## Trace Graph view

The Trace Graph view visualizes the traceability relationships in your spec as an interactive node-and-edge graph. Open it from the graph icon in the Overview toolbar.

![Trace graph](/img/screenshots/RQML-traceview-screenshot.png)

The graph shows:

- **Goals** linked to the requirements they drive
- **Requirements** linked to other requirements via `dependsOn`, `refines`, `satisfies`, and `constrains` edges
- **Scenarios** and **test cases** linked to their requirements
- **Implementation** evidence linked back to requirements

Nodes are clickable — selecting a node navigates to that item in the browser and source file. The graph updates automatically when the spec changes.
