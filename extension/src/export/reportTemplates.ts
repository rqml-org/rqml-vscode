// Hardcoded report templates for built-in report types

import type { ReportTemplate, ReportTypeInfo } from './generators/types';

export const REPORT_TYPES: ReportTypeInfo[] = [
  { id: 'full-spec', label: 'Full Specification', description: 'Complete specification document with all sections and items' },
  { id: 'executive-summary', label: 'Executive Summary', description: 'High-level overview with key metrics, goals, and status' },
  { id: 'traceability-matrix', label: 'Traceability Matrix', description: 'Requirements-to-tests coverage matrix' },
  { id: 'quality-assessment', label: 'Quality Assessment', description: 'Completeness, coverage gaps, and quality scores' },
  { id: 'implementation-status', label: 'Implementation Status', description: 'Per-requirement status breakdown with progress metrics' },
  { id: 'stakeholder-overview', label: 'Stakeholder Overview', description: 'Goals, scenarios, and key decisions for stakeholder review' },
  { id: 'other', label: 'Other...', description: 'Describe your report and let AI generate the structure' },
];

export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
  'full-spec': {
    id: 'full-spec',
    label: 'Full Specification',
    description: 'Complete specification document with all sections and items',
    slides: [
      { title: '{docTitle}', layout: 'title', dataSource: 'meta', content: 'RQML Requirements Specification' },
      { title: 'Document Overview', layout: 'content', dataSource: 'meta' },
      { title: 'Goals', layout: 'section-header', dataSource: 'goals' },
      { title: 'Goals Detail', layout: 'table', dataSource: 'goals' },
      { title: 'Requirements', layout: 'section-header', dataSource: 'requirements' },
      { title: 'Requirements Detail', layout: 'table', dataSource: 'requirements' },
      { title: 'Traceability', layout: 'table', dataSource: 'traces' },
      { title: 'Summary', layout: 'summary', dataSource: 'stats' },
    ],
  },
  'executive-summary': {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'High-level overview with key metrics, goals, and status',
    slides: [
      { title: '{docTitle}', layout: 'title', dataSource: 'meta', content: 'Executive Summary' },
      { title: 'Project Overview', layout: 'content', dataSource: 'meta' },
      { title: 'Key Goals', layout: 'content', dataSource: 'goals' },
      { title: 'Requirements at a Glance', layout: 'two-column', dataSource: 'stats' },
      { title: 'Status & Next Steps', layout: 'summary', dataSource: 'stats' },
    ],
  },
  'traceability-matrix': {
    id: 'traceability-matrix',
    label: 'Traceability Matrix',
    description: 'Requirements-to-tests coverage matrix',
    slides: [
      { title: '{docTitle}', layout: 'title', dataSource: 'meta', content: 'Traceability Matrix' },
      { title: 'Trace Overview', layout: 'content', dataSource: 'stats' },
      { title: 'Traceability Matrix', layout: 'table', dataSource: 'traces' },
      { title: 'Coverage Summary', layout: 'summary', dataSource: 'stats' },
    ],
  },
  'quality-assessment': {
    id: 'quality-assessment',
    label: 'Quality Assessment',
    description: 'Completeness, coverage gaps, and quality scores',
    slides: [
      { title: '{docTitle}', layout: 'title', dataSource: 'meta', content: 'Quality Assessment' },
      { title: 'Specification Quality', layout: 'two-column', dataSource: 'stats' },
      { title: 'Section Completeness', layout: 'table', dataSource: 'stats' },
      { title: 'Coverage Gaps', layout: 'content', dataSource: 'stats' },
      { title: 'Recommendations', layout: 'summary', dataSource: 'stats' },
    ],
  },
  'implementation-status': {
    id: 'implementation-status',
    label: 'Implementation Status',
    description: 'Per-requirement status breakdown with progress metrics',
    slides: [
      { title: '{docTitle}', layout: 'title', dataSource: 'meta', content: 'Implementation Status' },
      { title: 'Status Overview', layout: 'two-column', dataSource: 'stats' },
      { title: 'Requirements by Status', layout: 'table', dataSource: 'requirements' },
      { title: 'Progress Summary', layout: 'summary', dataSource: 'stats' },
    ],
  },
  'stakeholder-overview': {
    id: 'stakeholder-overview',
    label: 'Stakeholder Overview',
    description: 'Goals, scenarios, and key decisions for stakeholder review',
    slides: [
      { title: '{docTitle}', layout: 'title', dataSource: 'meta', content: 'Stakeholder Overview' },
      { title: 'Project Goals', layout: 'content', dataSource: 'goals' },
      { title: 'Key Scenarios', layout: 'content', dataSource: 'scenarios' },
      { title: 'Requirements Summary', layout: 'two-column', dataSource: 'stats' },
      { title: 'Discussion Points', layout: 'summary', dataSource: 'stats' },
    ],
  },
};
