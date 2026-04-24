// Export View Webview Provider
// REQ-EXP-005: Export functionality with multi-step wizard

import * as vscode from 'vscode';
import { getSpecService } from '../services/specService';
import { getConfigurationService } from '../services/configurationService';
import { getModelCatalogService } from '../services/modelCatalogService';
import { getWebviewContent } from './shared/getWebviewContent';
import type { ExportConfig, SectionTreeNode } from '../export/generators/types';
import { REPORT_REGISTRY } from '../export/reportRegistry';
import { ExportService } from '../export/exportService';

export class ExportViewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private exportService: ExportService;
  private lastExportUri: vscode.Uri | undefined;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
    this.exportService = new ExportService();
  }

  async show(): Promise<void> {
    const specService = getSpecService();
    const state = specService.state;

    if (!state.document) {
      vscode.window.showWarningMessage('No RQML specification loaded.');
      return;
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'rqmlExportView',
        'Export RQML Spec',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')]
        }
      );

      this.panel.webview.html = getWebviewContent(
        this.panel.webview,
        this.extensionUri,
        'export',
        'Export RQML Spec'
      );

      this.panel.webview.onDidReceiveMessage(
        this.handleMessage.bind(this),
        undefined,
        this.disposables
      );

      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
          this.disposables.forEach((d) => d.dispose());
          this.disposables = [];
        },
        undefined,
        this.disposables
      );
    }
  }

  private async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
    switch (message.type) {
      case 'requestSectionTree': {
        this.sendSectionTree();
        break;
      }
      case 'requestReportTypes': {
        this.sendReportTypes();
        break;
      }
      case 'requestModelList': {
        this.sendModelList();
        break;
      }
      case 'startExport': {
        const config = message.payload as ExportConfig;
        await this.runExport(config);
        break;
      }
      case 'openFile': {
        if (this.lastExportUri) {
          await vscode.env.openExternal(this.lastExportUri);
        }
        break;
      }
      case 'closePanel': {
        this.panel?.dispose();
        break;
      }
    }
  }

  private sendReportTypes(): void {
    if (!this.panel) return;
    this.panel.webview.postMessage({
      type: 'setReportTypes',
      payload: { registry: REPORT_REGISTRY },
    });
  }

  private async sendModelList(): Promise<void> {
    if (!this.panel) return;
    const configService = getConfigurationService();
    const catalogService = getModelCatalogService();

    const configured = await configService.getConfiguredProviders();
    const models: { endpointId: string; endpointName: string; modelId: string; displayName: string }[] = [];

    for (const providerId of configured) {
      const providerEntry = catalogService.getProviderEntry(providerId);
      const providerName = providerEntry?.displayName || providerId;
      const catalogModels = catalogService.getModelsForProvider(providerId);
      for (const m of catalogModels) {
        models.push({
          // Keep the `endpointId` name for wire compatibility with the export
          // webview — it now carries the provider id directly.
          endpointId: providerId,
          endpointName: providerName,
          modelId: m.modelId,
          displayName: m.displayName,
        });
      }
    }

    this.panel.webview.postMessage({
      type: 'setModelList',
      payload: { models },
    });
  }

  private sendSectionTree(): void {
    const specService = getSpecService();
    const doc = specService.state.document;
    if (!doc || !this.panel) return;

    const SECTION_LABELS: Record<string, string> = {
      meta: 'Meta',
      catalogs: 'Catalogs',
      domain: 'Domain Model',
      goals: 'Goals',
      scenarios: 'Scenarios',
      requirements: 'Requirements',
      behavior: 'Behavior',
      interfaces: 'Interfaces',
      verification: 'Verification',
      trace: 'Trace',
      governance: 'Governance',
    };

    const tree: SectionTreeNode[] = [];
    for (const [name, section] of doc.sections) {
      tree.push({
        name,
        label: SECTION_LABELS[name] || name,
        present: section.present,
        items: section.items.map(item => ({
          id: item.id,
          label: item.title || item.name || item.id,
        })),
      });
    }

    this.panel.webview.postMessage({
      type: 'setSectionTree',
      payload: { tree },
    });
  }

  private async runExport(config: ExportConfig): Promise<void> {
    if (!this.panel) return;

    const specService = getSpecService();
    const doc = specService.state.document;
    if (!doc) {
      this.panel.webview.postMessage({
        type: 'exportError',
        payload: { message: 'No RQML specification loaded.' },
      });
      return;
    }

    try {
      this.panel.webview.postMessage({
        type: 'exportProgress',
        payload: { stage: 'Generating presentation...', percent: 20 },
      });

      const buffer = await this.exportService.export(config, doc, (stage, percent) => {
        this.panel?.webview.postMessage({
          type: 'exportProgress',
          payload: { stage, percent },
        });
      });

      this.panel.webview.postMessage({
        type: 'exportProgress',
        payload: { stage: 'Saving file...', percent: 90 },
      });

      const defaultName = `${doc.docId || 'spec'}-export-${new Date().toISOString().slice(0, 10)}`;
      const filterMap: Record<string, string[]> = {
        pptx: ['pptx'],
        docx: ['docx'],
        xlsx: ['xlsx'],
        pdf: ['pdf'],
      };
      const filterLabel: Record<string, string> = {
        pptx: 'PowerPoint',
        docx: 'Word',
        xlsx: 'Excel',
        pdf: 'PDF',
      };

      const baseDir = vscode.workspace.workspaceFolders?.[0]?.uri
        ?? vscode.Uri.file(require('os').homedir());

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(baseDir, `${defaultName}.${config.format}`),
        filters: { [filterLabel[config.format] || 'File']: filterMap[config.format] || [config.format] },
      });

      if (!uri) {
        this.panel.webview.postMessage({
          type: 'exportError',
          payload: { message: 'Export cancelled.' },
        });
        return;
      }

      await vscode.workspace.fs.writeFile(uri, buffer);
      this.lastExportUri = uri;

      this.panel.webview.postMessage({
        type: 'exportComplete',
        payload: { filename: uri.fsPath.split('/').pop() || 'export' },
      });
    } catch (err) {
      this.panel?.webview.postMessage({
        type: 'exportError',
        payload: { message: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
