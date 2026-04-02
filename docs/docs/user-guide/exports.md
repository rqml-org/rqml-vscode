---
sidebar_position: 5
---

# Exports

The RQML extension can generate professional reports and documents from your specification using LLM-driven content generation. Access the export wizard from the export icon in the Overview toolbar, or right-click the "RQML Spec" root node and select "Export Spec...".

## Available reports

### Document reports

| Report | Description | Formats |
|---|---|---|
| **Full requirements specification** | Complete specification with all sections, requirements, acceptance criteria, and traceability | DOCX, PDF |
| **Functionality overview** | High-level summary of system capabilities and feature areas | PPTX, DOCX, PDF |
| **Investor presentation** | Strategic overview with vision, goals, progress metrics, and market positioning | PPTX, DOCX, PDF |
| **Project status report** | Current project status with progress metrics, risks, and blockers | PPTX, DOCX, PDF |
| **Release readiness review** | Release readiness assessment with verification status and outstanding items | PPTX |
| **API and integration specification** | Technical specification for APIs, interfaces, and integration points | DOCX, PDF |
| **Verification and acceptance pack** | Test coverage report with acceptance criteria and verification evidence | DOCX, PDF |
| **Baseline release specification** | Frozen specification baseline suitable for release documentation | DOCX, PDF |
| **Stakeholder review pack** | Goals, scenarios, and key decisions packaged for stakeholder review | PPTX, DOCX, PDF |
| **Project status snapshot** | One-page summary of project status, progress, and next steps | PPTX, DOCX, PDF |

### Tabular reports

| Report | Description | Format |
|---|---|---|
| **Requirements register** | All requirements in tabular format with ID, type, status, priority, and statement | XLSX |
| **Traceability matrix** | Requirements-to-requirements relationship matrix showing all trace edges | XLSX |
| **Requirements-to-tests matrix** | Coverage matrix mapping requirements to test cases and verification items | XLSX |
| **Interface inventory** | All interfaces, integration points, and external dependencies | XLSX |

## Output formats

| Format | Extension | Best for |
|---|---|---|
| **Word** | `.docx` | Detailed specifications, formal documents, review packs |
| **PowerPoint** | `.pptx` | Presentations, stakeholder reviews, status updates |
| **Excel** | `.xlsx` | Tabular data, matrices, registers, inventories |
| **PDF** | `.pdf` | Final documents, baselines, archived specifications |
| **Markdown** | `.md` | Text-based export for version control and wikis |

## Export wizard

The export follows a guided wizard flow:

1. **Select sections** — Choose which RQML sections to include in the export (goals, requirements, scenarios, test cases, traceability)
2. **Choose report type** — Pick from the report types listed above
3. **Choose format** — Select the output format (available formats depend on the report type)
4. **LLM guidance** (optional) — Enter free-text guidance to steer the tone, focus, or audience of the generated content
5. **Select model** — Choose which configured LLM endpoint and model to use for content generation

The agent uses the LLM to transform your structured RQML data into human-readable prose, tables, and presentation content appropriate for the selected report type and audience.

## How it works

The export system reads your RQML spec, selects the relevant sections, and sends them to the configured LLM with a report-type-specific prompt. The LLM generates the content, which is then formatted into the selected output format and saved to your chosen location.

After export, you're offered the option to open the generated file directly.
