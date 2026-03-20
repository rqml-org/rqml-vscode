// Prompt construction for LLM-driven report generation

import type { ExportData, ReportTypeId, ExportFormat } from './generators/types';
import { REPORT_PROMPTS } from './reportRegistry';

const BASE_SYSTEM_PROMPT = `You are a technical documentation expert generating structured reports from requirements specifications.

Your output must be a structured JSON report with sections, each containing content blocks.
Available content block types:
- "paragraph": Markdown-formatted text (supports **bold**, *italic*, inline code)
- "bullet-list": Array of bullet point strings
- "table": Headers array + rows (array of arrays)
- "key-value": Array of {key, value} pairs for structured data

Guidelines:
- Write professional, clear, and well-structured content
- Use the specification data provided — do not invent requirements or IDs
- Synthesize and summarize where appropriate rather than just listing raw data
- Each section should have a clear heading and flow logically
- For presentations (PPT), keep content concise and impactful — use bullet-list and key-value blocks
- For documents (Word/PDF), use paragraph blocks for narrative and table blocks for structured data
- For spreadsheets (Excel), prefer table blocks with comprehensive data`;

const FORMAT_HINTS: Record<ExportFormat, string> = {
  pptx: `\nFormat: PowerPoint presentation. Keep each section concise (1-2 slides worth of content). Use bullet-list and key-value blocks. Avoid long paragraphs. Use layoutHint to suggest slide types.`,
  docx: `\nFormat: Word document. Use full paragraphs for narrative sections. Tables for structured data. The layoutHint field is not needed.`,
  pdf: `\nFormat: PDF document. Same as Word — use full paragraphs and tables. The layoutHint field is not needed.`,
  xlsx: `\nFormat: Excel spreadsheet. Prefer table content blocks with comprehensive column headers and data rows. Each section will become a worksheet. Minimize paragraph blocks.`,
};

/**
 * Build the complete system prompt for report generation.
 */
export function buildSystemPrompt(reportType: ReportTypeId, format: ExportFormat, guidance?: string): string {
  const parts = [
    BASE_SYSTEM_PROMPT,
    FORMAT_HINTS[format],
    '',
    'Report type instructions:',
    REPORT_PROMPTS[reportType],
  ];

  if (guidance?.trim()) {
    parts.push('', 'Additional user instructions:', guidance.trim());
  }

  return parts.join('\n');
}

/**
 * Serialize ExportData into a compact text representation for the LLM prompt.
 */
export function serializeExportData(data: ExportData): string {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);
  lines.push(`Document ID: ${data.docId}`);
  lines.push(`Version: ${data.version}`);
  lines.push(`Status: ${data.status}`);
  lines.push('');

  for (const section of data.sections) {
    lines.push(`## ${section.name} (${section.items.length} items)`);
    for (const item of section.items) {
      const attrs = [item.status, item.priority].filter(Boolean).join(', ');
      lines.push(`- ${item.id}: ${item.title}${attrs ? ` [${attrs}]` : ''}`);
      if (item.children) {
        for (const child of item.children) {
          const childAttrs = [child.status, child.priority].filter(Boolean).join(', ');
          lines.push(`  - ${child.id}: ${child.title}${childAttrs ? ` [${childAttrs}]` : ''}`);
        }
      }
    }
    lines.push('');
  }

  if (data.traceEdges.length > 0) {
    lines.push(`## Trace Edges (${data.traceEdges.length})`);
    for (const edge of data.traceEdges) {
      lines.push(`- ${edge.id}: ${edge.from} → ${edge.to} (${edge.type})`);
    }
  }

  return lines.join('\n');
}

/**
 * Rough token estimation (~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
