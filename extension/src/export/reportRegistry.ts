// Report type registry — replaces static reportTemplates.ts
// Defines available report types, their allowed formats, and LLM prompt fragments

import type { ReportTypeDefinition, ReportTypeId } from './generators/types';

export const REPORT_REGISTRY: ReportTypeDefinition[] = [
  {
    id: 'full-spec',
    label: 'Full requirements specification',
    description: 'Complete specification document with all sections and items',
    formats: ['docx', 'pdf'],
  },
  {
    id: 'functionality-overview',
    label: 'Functionality overview',
    description: 'High-level summary of system capabilities and features',
    formats: ['pptx', 'docx', 'pdf'],
  },
  {
    id: 'investor-presentation',
    label: 'Investor presentation',
    description: 'Strategic overview for investors highlighting vision, goals, and progress',
    formats: ['pptx', 'docx', 'pdf'],
  },
  {
    id: 'project-status',
    label: 'Project status report',
    description: 'Current project status with progress metrics and risk assessment',
    formats: ['pptx', 'docx', 'pdf'],
  },
  {
    id: 'release-readiness',
    label: 'Release readiness review',
    description: 'Assessment of readiness for release with verification status',
    formats: ['pptx'],
  },
  {
    id: 'api-integration-spec',
    label: 'API and integration specification',
    description: 'Technical specification for APIs, interfaces, and integration points',
    formats: ['docx', 'pdf'],
  },
  {
    id: 'verification-acceptance',
    label: 'Verification and acceptance pack',
    description: 'Test coverage, verification results, and acceptance criteria',
    formats: ['docx', 'pdf'],
  },
  {
    id: 'baseline-release-spec',
    label: 'Baseline release specification',
    description: 'Frozen specification baseline for a specific release',
    formats: ['docx', 'pdf'],
  },
  {
    id: 'stakeholder-review',
    label: 'Stakeholder review pack',
    description: 'Goals, scenarios, and key decisions for stakeholder review',
    formats: ['pptx', 'docx', 'pdf'],
  },
  {
    id: 'project-status-snapshot',
    label: 'Project status snapshot',
    description: 'Quick one-page status summary with key metrics',
    formats: ['pptx', 'docx', 'pdf'],
  },
  {
    id: 'requirements-register',
    label: 'Requirements register',
    description: 'Tabular listing of all requirements with status and attributes',
    formats: ['xlsx'],
  },
  {
    id: 'traceability-matrix',
    label: 'Traceability matrix',
    description: 'Requirements-to-requirements traceability matrix',
    formats: ['xlsx'],
  },
  {
    id: 'requirements-tests-matrix',
    label: 'Requirements-to-tests matrix',
    description: 'Coverage matrix mapping requirements to verification tests',
    formats: ['xlsx'],
  },
  {
    id: 'interface-inventory',
    label: 'Interface inventory',
    description: 'Inventory of all system interfaces and integration points',
    formats: ['xlsx'],
  },
];

/**
 * Per-report-type system prompt fragments.
 * Combined with the base system prompt and user guidance in promptBuilder.ts.
 */
export const REPORT_PROMPTS: Record<ReportTypeId, string> = {
  'full-spec': `Generate a comprehensive requirements specification document. Include every section provided in full detail.
Use formal technical writing. Structure the output as: executive summary, then each specification section with all items listed.
For requirements and goals, include IDs, descriptions, status, and priority. For trace edges, show the traceability relationships.`,

  'functionality-overview': `Generate a high-level functionality overview presentation. Synthesize requirements into capability areas.
Focus on WHAT the system does, not implementation details. Group related features into coherent themes.
Use clear, non-technical language suitable for a broad audience. Highlight key differentiators.`,

  'investor-presentation': `Generate an investor-facing presentation. Lead with the vision and market opportunity.
Translate requirements into business value. Emphasize progress, milestones, and roadmap.
Use confident, forward-looking language. Include metrics where available. Keep slides focused and impactful.`,

  'project-status': `Generate a project status report. Focus on progress against goals, recent achievements, and upcoming milestones.
Identify risks and blockers. Show completion metrics by section. Highlight items that need attention.
Use a balanced tone — factual and actionable.`,

  'release-readiness': `Generate a release readiness review presentation. Assess whether the system is ready for release.
Evaluate verification coverage, open issues, and outstanding requirements.
Provide a clear go/no-go recommendation with supporting evidence. List any conditions or caveats.`,

  'api-integration-spec': `Generate a technical API and integration specification. Focus on interfaces, protocols, and data models.
Structure by integration point or interface group. Include endpoint details, data formats, and constraints.
Use precise technical language. Reference relevant requirements IDs.`,

  'verification-acceptance': `Generate a verification and acceptance pack. Map requirements to their verification criteria and test status.
Show coverage metrics — what percentage of requirements have verification items. Identify gaps.
Include pass/fail summaries and any outstanding defects.`,

  'baseline-release-spec': `Generate a baseline release specification. This is a frozen snapshot of the specification at a point in time.
Include all sections with their current state. Mark items by their status (approved, draft, proposed).
Use formal document structure with clear section numbering.`,

  'stakeholder-review': `Generate a stakeholder review pack. Focus on goals, scenarios, and key decisions that need stakeholder input.
Present information at a strategic level. Highlight trade-offs and decision points.
Use clear, accessible language. Include discussion prompts for each major topic.`,

  'project-status-snapshot': `Generate a concise project status snapshot — think one-pager or single slide deck.
Key metrics up front: total requirements, completion %, coverage gaps.
Quick wins, risks, and next steps. Keep it scannable and high-impact.`,

  'requirements-register': `Generate a comprehensive requirements register. This is a tabular format with every requirement listed.
Include columns: ID, Title, Description, Status, Priority, Section, and any other available attributes.
Sort by section, then by ID. Include summary counts at the end.`,

  'traceability-matrix': `Generate a traceability matrix showing relationships between requirements.
Use a matrix format with source requirements on rows and target requirements on columns.
Mark traced relationships. Include a coverage summary showing which requirements lack traces.`,

  'requirements-tests-matrix': `Generate a requirements-to-tests coverage matrix.
Map each requirement to its associated verification items. Show coverage status.
Highlight requirements without verification and verification items without linked requirements.`,

  'interface-inventory': `Generate an interface inventory spreadsheet. List all interfaces defined in the specification.
Include columns: ID, Name, Type, Direction, Protocol, Connected Systems, Status.
Group by interface type or connected system.`,
};
