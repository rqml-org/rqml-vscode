// Shared types for the export pipeline
// REQ-EXP-005: LLM-driven export functionality

import type { Provenance } from './provenance';
import type { GeneratedReport } from '../schemas/reportOutput';

export type ExportFormat = 'pptx' | 'docx' | 'xlsx' | 'pdf';

export type ReportTypeId =
  | 'full-spec'
  | 'functionality-overview'
  | 'investor-presentation'
  | 'project-status'
  | 'release-readiness'
  | 'api-integration-spec'
  | 'verification-acceptance'
  | 'baseline-release-spec'
  | 'stakeholder-review'
  | 'project-status-snapshot'
  | 'requirements-register'
  | 'traceability-matrix'
  | 'requirements-tests-matrix'
  | 'interface-inventory';

export interface ReportTypeDefinition {
  id: ReportTypeId;
  label: string;
  description: string;
  formats: ExportFormat[];
}

export interface SelectedSection {
  sectionName: string;
  /** Empty array means all items in the section are selected */
  selectedItemIds: string[];
}

export interface ExportConfig {
  format: ExportFormat;
  reportType: ReportTypeId;
  selectedSections: SelectedSection[];
  /** Endpoint to use for LLM generation */
  modelEndpointId?: string;
  /** Specific model within the endpoint */
  modelId?: string;
  /** Additional user guidance for the LLM */
  guidance?: string;
  /**
   * REQ-EXP-013: render from @rqml/core alone — no model, no network, and a
   * byte-identical result for an unchanged specification. This is the default;
   * a language-model narrative is the opt-in.
   */
  deterministic?: boolean;
}

/** Flat export-ready representation of spec data, scoped to selected sections */
export interface ExportDataItem {
  id: string;
  type: string;
  title: string;
  status?: string;
  priority?: string;
  section: string;
  children?: ExportDataItem[];
}

export interface ExportDataSection {
  name: string;
  items: ExportDataItem[];
}

export interface ExportTraceEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  notes?: string;
}

export interface ExportData {
  title: string;
  docId: string;
  version: string;
  status: string;
  sections: ExportDataSection[];
  traceEdges: ExportTraceEdge[];
  /**
   * Rich markdown rendering of the selected sections (full statements,
   * acceptance criteria, goals, scenarios, behavior, etc.), produced by
   * rqml-core's outline serializer. This is what the LLM prompt consumes; the
   * flat `sections`/`traceEdges` above remain for the format generators.
   */
  content?: string;
}

export interface ExportGenerator {
  /**
   * `provenance` makes the output reproducible (REQ-EXP-013). When omitted the
   * generator stamps the current date, which is correct for the
   * language-model path — that output is not reproducible regardless.
   */
  generate(
    report: GeneratedReport,
    metadata: ExportData,
    provenance?: Provenance
  ): Promise<Buffer>;
}

/** Section tree node sent to the webview for the checkbox selector */
export interface SectionTreeNode {
  name: string;
  label: string;
  present: boolean;
  items: { id: string; label: string }[];
}
