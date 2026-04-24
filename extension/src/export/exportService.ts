// Export orchestrator: LLM-driven pipeline
// Transforms spec data → LLM generates content → format generator renders file

import type { LanguageModel } from 'ai';
import type { RqmlDocument } from '../services/rqmlParser';
import type { ExportConfig, ExportData } from './generators/types';
import { transformToExportData } from './rqmlToExportData';
import { LlmReportGenerator } from './llmReportGenerator';
import { PptxGenerator } from './generators/pptxGenerator';
import { DocxGenerator } from './generators/docxGenerator';
import { PdfGenerator } from './generators/pdfGenerator';
import { XlsxGenerator } from './generators/xlsxGenerator';
import { getLlmService } from '../services/llmService';
import { getConfigurationService } from '../services/configurationService';
import { getModelCatalogService } from '../services/modelCatalogService';

type ProgressCallback = (stage: string, percent: number) => void;

export class ExportService {
  private llmGenerator = new LlmReportGenerator();

  async export(
    config: ExportConfig,
    doc: RqmlDocument,
    onProgress?: ProgressCallback
  ): Promise<Buffer> {
    // 1. Transform spec data per selection
    onProgress?.('Preparing specification data...', 10);
    const data = transformToExportData(doc, config.selectedSections);

    // 2. Resolve LLM model
    onProgress?.('Connecting to AI model...', 20);
    const model = await this.resolveModel(config);

    // 3. Generate content via LLM
    const report = await this.llmGenerator.generate({
      model,
      reportType: config.reportType,
      format: config.format,
      exportData: data,
      guidance: config.guidance,
      onProgress,
    });

    // 4. Render to target format
    onProgress?.('Rendering document...', 80);
    const generator = this.getGenerator(config.format);
    const buffer = await generator.generate(report, data);

    onProgress?.('Done', 100);
    return buffer;
  }

  private async resolveModel(config: ExportConfig): Promise<LanguageModel> {
    // If a specific provider/model was selected in the wizard, use that.
    // The legacy field `modelEndpointId` now carries the provider id.
    if (config.modelEndpointId && config.modelId) {
      const configService = getConfigurationService();
      const catalogService = getModelCatalogService();
      const providerId = config.modelEndpointId as import('../types/configuration').ProviderId;

      const apiKey = await configService.getProviderApiKey(providerId);
      if (apiKey) {
        return await catalogService.createModel(providerId, config.modelId, apiKey);
      }
    }

    // Fall back to the active model
    return await getLlmService().getModel();
  }

  private getGenerator(format: string) {
    switch (format) {
      case 'pptx':
        return new PptxGenerator();
      case 'docx':
        return new DocxGenerator();
      case 'pdf':
        return new PdfGenerator();
      case 'xlsx':
        return new XlsxGenerator();
      default:
        throw new Error(`Export format "${format}" is not supported.`);
    }
  }
}
