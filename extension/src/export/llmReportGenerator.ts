// LLM-driven report content generation
// Uses Vercel AI SDK generateObject with Zod schema for structured output

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { generatedReport, type GeneratedReport } from './schemas/reportOutput';
import type { ExportData, ReportTypeId, ExportFormat } from './generators/types';
import { buildSystemPrompt, serializeExportData } from './promptBuilder';

export class LlmReportGenerator {
  async generate(params: {
    model: LanguageModel;
    reportType: ReportTypeId;
    format: ExportFormat;
    exportData: ExportData;
    guidance?: string;
    onProgress?: (stage: string, percent: number) => void;
  }): Promise<GeneratedReport> {
    const { model, reportType, format, exportData, guidance, onProgress } = params;

    onProgress?.('Building prompt from specification data...', 30);

    const systemPrompt = buildSystemPrompt(reportType, format, guidance);
    const userContent = serializeExportData(exportData);

    onProgress?.('Generating report content with AI...', 40);

    const { object } = await generateObject({
      model,
      schema: generatedReport,
      system: systemPrompt,
      prompt: userContent,
    });

    onProgress?.('AI content generated', 70);
    return object;
  }
}
