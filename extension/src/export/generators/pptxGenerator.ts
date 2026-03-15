// PPTX generation using PptxGenJS
// REQ-EXP-005: Export functionality

import PptxGenJS from 'pptxgenjs';
import type {
  ExportGenerator,
  ReportTemplate,
  ExportData,
  SlideDefinition,
  ExportDataSection,
  ExportDataItem,
  ExportTraceEdge,
} from './types';

// Brand colors
const BRAND = {
  primary: '2B579A',    // dark blue
  secondary: '5B9BD5',  // light blue
  accent: '70AD47',     // green
  dark: '333333',
  medium: '666666',
  light: 'A0A0A0',
  white: 'FFFFFF',
  background: 'F5F5F5',
  tableBorder: 'CCCCCC',
  tableHeader: '2B579A',
  tableStripe: 'F0F4FA',
};

const FONT = {
  heading: 'Segoe UI',
  body: 'Segoe UI',
};

export class PptxGenerator implements ExportGenerator {
  async generate(template: ReportTemplate, data: ExportData): Promise<Buffer> {
    const pptx = new PptxGenJS();
    pptx.author = 'RQML Export';
    pptx.title = data.title || 'RQML Specification';
    pptx.subject = template.label;

    pptx.defineSlideMaster({
      title: 'RQML_MASTER',
      background: { color: BRAND.white },
    });

    for (const slideDef of template.slides) {
      this.renderSlide(pptx, slideDef, data);
    }

    const output = await pptx.write({ outputType: 'nodebuffer' });
    return Buffer.from(output as ArrayBuffer);
  }

  private renderSlide(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    switch (def.layout) {
      case 'title':
        this.renderTitleSlide(pptx, def, data);
        break;
      case 'section-header':
        this.renderSectionHeader(pptx, def, data);
        break;
      case 'content':
        this.renderContentSlide(pptx, def, data);
        break;
      case 'table':
        this.renderTableSlide(pptx, def, data);
        break;
      case 'two-column':
        this.renderTwoColumnSlide(pptx, def, data);
        break;
      case 'summary':
        this.renderSummarySlide(pptx, def, data);
        break;
    }
  }

  // ── Title slide ───────────────────────────────────────────────────
  private renderTitleSlide(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });

    // Background accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08, fill: { color: BRAND.primary },
    });

    const title = def.title.replace('{docTitle}', data.title);
    slide.addText(title, {
      x: 0.8, y: 1.8, w: 8.4, h: 1.2,
      fontSize: 32, fontFace: FONT.heading, color: BRAND.dark,
      bold: true, align: 'center',
    });

    if (def.content) {
      slide.addText(def.content, {
        x: 0.8, y: 3.0, w: 8.4, h: 0.6,
        fontSize: 18, fontFace: FONT.body, color: BRAND.medium,
        align: 'center',
      });
    }

    // Metadata line
    const metaLine = [data.docId, `v${data.version}`, data.status].filter(Boolean).join('  ·  ');
    slide.addText(metaLine, {
      x: 0.8, y: 4.2, w: 8.4, h: 0.4,
      fontSize: 11, fontFace: FONT.body, color: BRAND.light,
      align: 'center',
    });

    // Bottom bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 5.42, w: '100%', h: 0.08, fill: { color: BRAND.secondary },
    });
  }

  // ── Section header ────────────────────────────────────────────────
  private renderSectionHeader(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08, fill: { color: BRAND.primary },
    });

    const section = this.findSection(data, def.dataSource);
    const itemCount = section ? section.items.length : 0;

    slide.addText(def.title, {
      x: 0.8, y: 2.0, w: 8.4, h: 1.0,
      fontSize: 28, fontFace: FONT.heading, color: BRAND.primary,
      bold: true, align: 'center',
    });

    slide.addText(`${itemCount} items`, {
      x: 0.8, y: 3.0, w: 8.4, h: 0.5,
      fontSize: 14, fontFace: FONT.body, color: BRAND.medium,
      align: 'center',
    });
  }

  // ── Content slide (bullet list) ───────────────────────────────────
  private renderContentSlide(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
    this.addSlideTitle(slide, def.title);

    const items = this.getContentItems(def.dataSource, data);

    if (items.length === 0) {
      slide.addText('No data available for this section.', {
        x: 0.8, y: 1.6, w: 8.4, h: 0.5,
        fontSize: 13, fontFace: FONT.body, color: BRAND.light, italic: true,
      });
      return;
    }

    // Render as bullet list — paginate if >8 items
    const pageSize = 8;
    const firstPage = items.slice(0, pageSize);

    const textRows = firstPage.map(item => ({
      text: `${item.id}: ${item.title}${item.status ? ` [${item.status}]` : ''}`,
      options: { fontSize: 13, fontFace: FONT.body, color: BRAND.dark, bullet: true, breakLine: true },
    }));

    slide.addText(textRows as any, {
      x: 0.8, y: 1.6, w: 8.4, h: 3.6,
      valign: 'top',
    });

    // Overflow slides
    for (let i = pageSize; i < items.length; i += pageSize) {
      const page = items.slice(i, i + pageSize);
      const contSlide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(contSlide, `${def.title} (cont.)`);

      const rows = page.map(item => ({
        text: `${item.id}: ${item.title}${item.status ? ` [${item.status}]` : ''}`,
        options: { fontSize: 13, fontFace: FONT.body, color: BRAND.dark, bullet: true, breakLine: true },
      }));

      contSlide.addText(rows as any, {
        x: 0.8, y: 1.6, w: 8.4, h: 3.6,
        valign: 'top',
      });
    }
  }

  // ── Table slide ───────────────────────────────────────────────────
  private renderTableSlide(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    if (def.dataSource === 'traces') {
      this.renderTraceTable(pptx, def, data);
      return;
    }

    const section = this.findSection(data, def.dataSource);
    if (!section || section.items.length === 0) {
      const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(slide, def.title);
      slide.addText('No data available.', {
        x: 0.8, y: 1.6, w: 8.4, h: 0.5,
        fontSize: 13, fontFace: FONT.body, color: BRAND.light, italic: true,
      });
      return;
    }

    const headerRow = [
      { text: 'ID', options: this.tableHeaderStyle(1.5) },
      { text: 'Title', options: this.tableHeaderStyle(4.0) },
      { text: 'Status', options: this.tableHeaderStyle(1.5) },
      { text: 'Priority', options: this.tableHeaderStyle(1.4) },
    ];

    const pageSize = 10;
    for (let i = 0; i < section.items.length; i += pageSize) {
      const page = section.items.slice(i, i + pageSize);
      const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(slide, i === 0 ? def.title : `${def.title} (cont.)`);

      const rows: any[][] = [headerRow];
      page.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? BRAND.white : BRAND.tableStripe;
        rows.push([
          { text: item.id, options: this.tableCellStyle(bg) },
          { text: item.title, options: this.tableCellStyle(bg) },
          { text: item.status || '—', options: this.tableCellStyle(bg) },
          { text: item.priority || '—', options: this.tableCellStyle(bg) },
        ]);
      });

      slide.addTable(rows, {
        x: 0.5, y: 1.5, w: 9.0,
        border: { type: 'solid', pt: 0.5, color: BRAND.tableBorder },
        colW: [1.5, 4.0, 1.5, 1.4],
        fontSize: 11,
        fontFace: FONT.body,
      });
    }
  }

  private renderTraceTable(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    if (data.traceEdges.length === 0) {
      const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(slide, def.title);
      slide.addText('No trace edges defined.', {
        x: 0.8, y: 1.6, w: 8.4, h: 0.5,
        fontSize: 13, fontFace: FONT.body, color: BRAND.light, italic: true,
      });
      return;
    }

    const headerRow = [
      { text: 'ID', options: this.tableHeaderStyle(1.8) },
      { text: 'From', options: this.tableHeaderStyle(2.5) },
      { text: 'To', options: this.tableHeaderStyle(2.5) },
      { text: 'Type', options: this.tableHeaderStyle(1.6) },
    ];

    const pageSize = 10;
    for (let i = 0; i < data.traceEdges.length; i += pageSize) {
      const page = data.traceEdges.slice(i, i + pageSize);
      const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(slide, i === 0 ? def.title : `${def.title} (cont.)`);

      const rows: any[][] = [headerRow];
      page.forEach((edge, idx) => {
        const bg = idx % 2 === 0 ? BRAND.white : BRAND.tableStripe;
        rows.push([
          { text: edge.id, options: this.tableCellStyle(bg) },
          { text: edge.from, options: this.tableCellStyle(bg) },
          { text: edge.to, options: this.tableCellStyle(bg) },
          { text: edge.type, options: this.tableCellStyle(bg) },
        ]);
      });

      slide.addTable(rows, {
        x: 0.5, y: 1.5, w: 9.0,
        border: { type: 'solid', pt: 0.5, color: BRAND.tableBorder },
        colW: [1.8, 2.5, 2.5, 1.6],
        fontSize: 11,
        fontFace: FONT.body,
      });
    }
  }

  // ── Two-column slide ──────────────────────────────────────────────
  private renderTwoColumnSlide(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
    this.addSlideTitle(slide, def.title);

    const stats = this.computeStats(data);

    // Left column — counts
    const leftLines = [
      { text: 'Sections', options: { fontSize: 12, bold: true, color: BRAND.medium, breakLine: true } },
      { text: `${stats.sectionCount} included`, options: { fontSize: 18, bold: true, color: BRAND.primary, breakLine: true } },
      { text: '', options: { fontSize: 8, breakLine: true } },
      { text: 'Items', options: { fontSize: 12, bold: true, color: BRAND.medium, breakLine: true } },
      { text: `${stats.totalItems} total`, options: { fontSize: 18, bold: true, color: BRAND.primary, breakLine: true } },
      { text: '', options: { fontSize: 8, breakLine: true } },
      { text: 'Traces', options: { fontSize: 12, bold: true, color: BRAND.medium, breakLine: true } },
      { text: `${stats.traceCount} edges`, options: { fontSize: 18, bold: true, color: BRAND.primary, breakLine: true } },
    ];

    slide.addText(leftLines as any, {
      x: 0.8, y: 1.6, w: 4.0, h: 3.4,
      valign: 'top',
    });

    // Right column — status breakdown
    const rightLines: any[] = [
      { text: 'By Status', options: { fontSize: 12, bold: true, color: BRAND.medium, breakLine: true } },
    ];
    for (const [status, count] of Object.entries(stats.statusCounts)) {
      rightLines.push({
        text: `${status}: ${count}`,
        options: { fontSize: 14, color: BRAND.dark, bullet: true, breakLine: true },
      });
    }
    if (rightLines.length === 1) {
      rightLines.push({
        text: 'No status data available',
        options: { fontSize: 13, color: BRAND.light, italic: true, breakLine: true },
      });
    }

    slide.addText(rightLines, {
      x: 5.2, y: 1.6, w: 4.0, h: 3.4,
      valign: 'top',
    });
  }

  // ── Summary slide ─────────────────────────────────────────────────
  private renderSummarySlide(pptx: PptxGenJS, def: SlideDefinition, data: ExportData): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
    this.addSlideTitle(slide, def.title);

    const stats = this.computeStats(data);

    const summaryLines = [
      `Document: ${data.title} (${data.docId})`,
      `Version: ${data.version}   Status: ${data.status}`,
      '',
      `Sections exported: ${stats.sectionCount}`,
      `Total items: ${stats.totalItems}`,
      `Trace edges: ${stats.traceCount}`,
    ];

    if (Object.keys(stats.statusCounts).length > 0) {
      summaryLines.push('');
      summaryLines.push('Status breakdown:');
      for (const [status, count] of Object.entries(stats.statusCounts)) {
        summaryLines.push(`  ${status}: ${count}`);
      }
    }

    slide.addText(summaryLines.join('\n'), {
      x: 0.8, y: 1.6, w: 8.4, h: 3.4,
      fontSize: 13, fontFace: FONT.body, color: BRAND.dark,
      valign: 'top',
    });

    // Footer
    slide.addText(`Generated by RQML · ${new Date().toLocaleDateString()}`, {
      x: 0.8, y: 5.0, w: 8.4, h: 0.3,
      fontSize: 9, fontFace: FONT.body, color: BRAND.light,
      align: 'center',
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private addSlideTitle(slide: PptxGenJS.Slide, title: string): void {
    slide.addShape('rect' as any, {
      x: 0, y: 0, w: '100%', h: 0.04, fill: { color: BRAND.primary },
    });
    slide.addText(title, {
      x: 0.5, y: 0.3, w: 9.0, h: 0.6,
      fontSize: 20, fontFace: FONT.heading, color: BRAND.primary, bold: true,
    });
    slide.addShape('line' as any, {
      x: 0.5, y: 1.0, w: 9.0, h: 0,
      line: { color: BRAND.tableBorder, width: 0.5 },
    });
  }

  private findSection(data: ExportData, name: string): ExportDataSection | undefined {
    return data.sections.find(s => s.name === name);
  }

  private getContentItems(dataSource: string, data: ExportData): ExportDataItem[] {
    if (dataSource === 'meta') {
      const meta = this.findSection(data, 'meta');
      return meta?.items || [];
    }
    if (dataSource === 'stats') {
      return [];
    }
    const section = this.findSection(data, dataSource);
    return section?.items || [];
  }

  private computeStats(data: ExportData) {
    const statusCounts: Record<string, number> = {};
    let totalItems = 0;

    for (const section of data.sections) {
      totalItems += section.items.length;
      for (const item of section.items) {
        const st = item.status || 'unset';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
        if (item.children) {
          totalItems += item.children.length;
          for (const child of item.children) {
            const cst = child.status || 'unset';
            statusCounts[cst] = (statusCounts[cst] || 0) + 1;
          }
        }
      }
    }

    return {
      sectionCount: data.sections.length,
      totalItems,
      traceCount: data.traceEdges.length,
      statusCounts,
    };
  }

  private tableHeaderStyle(w?: number) {
    return {
      fill: { color: BRAND.tableHeader },
      color: BRAND.white,
      bold: true,
      fontSize: 11,
      fontFace: FONT.body,
      align: 'left' as const,
      valign: 'middle' as const,
    };
  }

  private tableCellStyle(bgColor: string) {
    return {
      fill: { color: bgColor },
      color: BRAND.dark,
      fontSize: 11,
      fontFace: FONT.body,
      align: 'left' as const,
      valign: 'middle' as const,
    };
  }
}
