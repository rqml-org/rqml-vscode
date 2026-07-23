// Export orchestrator: LLM-driven pipeline
// Transforms spec data → LLM generates content → format generator renders file

import type { LanguageModel } from 'ai';
import type { RqmlDocument } from '../services/rqmlParser';
import type { RqmlDocument as CoreDocument } from '../services/core';
import { loadCore } from '../services/core';
import type { ExportConfig, ExportData } from './generators/types';
import { transformToExportData } from './rqmlToExportData';
import { scopeOutline } from './exportMarkdown';
import { LlmReportGenerator } from './llmReportGenerator';
import { PptxGenerator } from './generators/pptxGenerator';
import { DocxGenerator } from './generators/docxGenerator';
import { PdfGenerator } from './generators/pdfGenerator';
import { XlsxGenerator } from './generators/xlsxGenerator';
import { getLlmService } from '../services/llmService';
import { getConfigurationService } from '../services/configurationService';
import { getModelCatalogService } from '../services/modelCatalogService';
import * as vscode from 'vscode';
import { buildDeterministicExport } from './deterministicExport';

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

    // REQ-EXP-013: the deterministic path. Nothing below reads a model, the
    // network or the clock, so the same specification yields the same bytes.
    if (config.deterministic !== false) {
      onProgress?.('Rendering from the specification...', 40);
      const xml = await this.readSpecSource(doc);
      const built = await buildDeterministicExport(xml, {
        sections: config.selectedSections.map((s) => s.sectionName),
      });

      onProgress?.('Rendering document...', 80);
      const buffer = await this.getGenerator(config.format).generate(built.report, data, {
        specHash: built.specHash,
        date: built.date,
      });
      onProgress?.('Done', 100);
      return buffer;
    }

    data.content = await this.buildContent(doc, config);

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

  /**
   * Read the specification source.
   *
   * The deterministic export digests and renders the XML itself rather than the
   * parsed view model, so the digest identifies exactly the bytes a reviewer
   * would diff.
   */
  private async readSpecSource(doc: RqmlDocument): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(doc.uri);
    return Buffer.from(bytes).toString('utf8');
  }

  /**
   * Build the rich markdown the LLM consumes. The view document carries the
   * typed core document on `.raw` (set by the parser adapter); we render its
   * outline scoped to the wizard's section/item selection.
   */
  private async buildContent(doc: RqmlDocument, config: ExportConfig): Promise<string> {
    const core = await loadCore();
    const coreDoc = doc.raw as CoreDocument;
    const outline = core.buildOutline(coreDoc);
    const scoped = scopeOutline(outline, config.selectedSections);
    return core.outlineToMarkdown(scoped);
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
