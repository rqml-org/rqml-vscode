// Zod schema for LLM-generated report output
// Used with Vercel AI SDK generateObject for structured output

import { z } from 'zod';

export const generatedParagraph = z.object({
  type: z.literal('paragraph'),
  text: z.string().describe('Markdown-formatted text content'),
});

export const generatedBulletList = z.object({
  type: z.literal('bullet-list'),
  items: z.array(z.string()).describe('List of bullet point items'),
});

export const generatedTable = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()).describe('Column headers'),
  rows: z.array(z.array(z.string())).describe('Table rows, each row is an array of cell values'),
});

export const generatedKeyValue = z.object({
  type: z.literal('key-value'),
  pairs: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).describe('Key-value pairs for structured data'),
});

export const generatedContent = z.discriminatedUnion('type', [
  generatedParagraph,
  generatedBulletList,
  generatedTable,
  generatedKeyValue,
]);

export const generatedSection = z.object({
  heading: z.string().describe('Section heading'),
  layoutHint: z.enum([
    'title',
    'section-header',
    'content',
    'table',
    'two-column',
    'summary',
    'auto',
  ]).default('auto').describe('Layout hint for presentation formats (PPT). Ignored by document formats.'),
  content: z.array(generatedContent).describe('Content blocks within this section'),
});

export const generatedReport = z.object({
  title: z.string().describe('Report title'),
  subtitle: z.string().optional().describe('Report subtitle'),
  sections: z.array(generatedSection).describe('Report sections in order'),
});

export type GeneratedReport = z.infer<typeof generatedReport>;
export type GeneratedSection = z.infer<typeof generatedSection>;
export type GeneratedContent = z.infer<typeof generatedContent>;
