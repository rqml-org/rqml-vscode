// Export orchestrator: resolves template, transforms data, dispatches to generator

import type { RqmlDocument } from '../services/rqmlParser';
import type { ExportConfig, ReportTemplate, ExportData } from './generators/types';
import { REPORT_TEMPLATES } from './reportTemplates';
import { transformToExportData } from './rqmlToExportData';
import { PptxGenerator } from './generators/pptxGenerator';

type ProgressCallback = (stage: string, percent: number) => void;

export class ExportService {
  async export(
    config: ExportConfig,
    doc: RqmlDocument,
    onProgress?: ProgressCallback
  ): Promise<Buffer> {
    // 1. Resolve template
    onProgress?.('Resolving report template...', 10);
    const template = await this.resolveTemplate(config);

    // 2. Transform spec data per selection
    onProgress?.('Preparing data...', 30);
    const data = transformToExportData(doc, config.selectedSections);

    // 3. Dispatch to format-specific generator
    onProgress?.('Generating file...', 50);
    const generator = this.getGenerator(config.format);
    const buffer = await generator.generate(template, data);

    onProgress?.('Done', 100);
    return buffer;
  }

  private async resolveTemplate(config: ExportConfig): Promise<ReportTemplate> {
    if (config.reportType === 'other') {
      // TODO: Phase 4 — LLM-generated template from config.customPrompt
      // For now, fall back to full-spec template
      return REPORT_TEMPLATES['full-spec'];
    }

    const template = REPORT_TEMPLATES[config.reportType];
    if (!template) {
      throw new Error(`Unknown report type: ${config.reportType}`);
    }
    return template;
  }

  private getGenerator(format: string) {
    switch (format) {
      case 'pptx':
        return new PptxGenerator();
      default:
        throw new Error(`Export format "${format}" is not yet supported.`);
    }
  }
}
