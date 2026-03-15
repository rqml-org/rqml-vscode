// Shared types for the export pipeline

export type ExportFormat = 'pptx' | 'docx' | 'xlsx' | 'pdf';

export type ReportTypeId =
  | 'full-spec'
  | 'executive-summary'
  | 'traceability-matrix'
  | 'quality-assessment'
  | 'implementation-status'
  | 'stakeholder-overview'
  | 'other';

export interface ReportTypeInfo {
  id: ReportTypeId;
  label: string;
  description: string;
}

export interface SelectedSection {
  sectionName: string;
  /** Empty array means all items in the section are selected */
  selectedItemIds: string[];
}

export interface ExportConfig {
  format: ExportFormat;
  reportType: ReportTypeId;
  customPrompt?: string;
  selectedSections: SelectedSection[];
}

export type SlideLayout =
  | 'title'
  | 'section-header'
  | 'content'
  | 'table'
  | 'two-column'
  | 'summary';

export interface SlideDefinition {
  title: string;
  layout: SlideLayout;
  /** Which data to pull: a section name, 'meta', 'traces', 'stats', or 'custom' */
  dataSource: string;
  /** Static or template text for custom content */
  content?: string;
}

export interface ReportTemplate {
  id: ReportTypeId;
  label: string;
  description: string;
  slides: SlideDefinition[];
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
  generate(template: ReportTemplate, data: ExportData): Promise<Buffer>;
}

/** Section tree node sent to the webview for the checkbox selector */
export interface SectionTreeNode {
  name: string;
  label: string;
  present: boolean;
  items: { id: string; label: string }[];
}
