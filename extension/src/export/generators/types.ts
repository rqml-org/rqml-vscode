// Shared types for the export pipeline
// REQ-EXP-005: LLM-driven export functionality

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
}

export interface ExportGenerator {
  generate(report: GeneratedReport, metadata: ExportData): Promise<Buffer>;
}

/** Section tree node sent to the webview for the checkbox selector */
export interface SectionTreeNode {
  name: string;
  label: string;
  present: boolean;
  items: { id: string; label: string }[];
}
