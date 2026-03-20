// PPTX generation using PptxGenJS
// REQ-EXP-005: Export functionality — renders LLM-generated content into slides

import PptxGenJS from 'pptxgenjs';
import type { ExportGenerator, ExportData } from './types';
import type { GeneratedReport, GeneratedSection, GeneratedContent } from '../schemas/reportOutput';

// Brand colors
const BRAND = {
  primary: '2B579A',
  secondary: '5B9BD5',
  accent: '70AD47',
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
  async generate(report: GeneratedReport, metadata: ExportData): Promise<Buffer> {
    const pptx = new PptxGenJS();
    pptx.author = 'RQML Export';
    pptx.title = report.title;
    pptx.subject = report.subtitle || 'RQML Specification Report';

    pptx.defineSlideMaster({
      title: 'RQML_MASTER',
      background: { color: BRAND.white },
    });

    // Title slide
    this.renderTitleSlide(pptx, report, metadata);

    // Content slides from LLM sections
    for (const section of report.sections) {
      this.renderSection(pptx, section);
    }

    // Footer slide
    this.renderFooterSlide(pptx, metadata);

    const output = await pptx.write({ outputType: 'nodebuffer' });
    return Buffer.from(output as ArrayBuffer);
  }

  private renderTitleSlide(pptx: PptxGenJS, report: GeneratedReport, metadata: ExportData): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08, fill: { color: BRAND.primary },
    });

    slide.addText(report.title, {
      x: 0.8, y: 1.8, w: 8.4, h: 1.2,
      fontSize: 32, fontFace: FONT.heading, color: BRAND.dark,
      bold: true, align: 'center',
    });

    if (report.subtitle) {
      slide.addText(report.subtitle, {
        x: 0.8, y: 3.0, w: 8.4, h: 0.6,
        fontSize: 18, fontFace: FONT.body, color: BRAND.medium,
        align: 'center',
      });
    }

    const metaLine = [metadata.docId, `v${metadata.version}`, metadata.status].filter(Boolean).join('  ·  ');
    slide.addText(metaLine, {
      x: 0.8, y: 4.2, w: 8.4, h: 0.4,
      fontSize: 11, fontFace: FONT.body, color: BRAND.light,
      align: 'center',
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 5.42, w: '100%', h: 0.08, fill: { color: BRAND.secondary },
    });
  }

  private renderSection(pptx: PptxGenJS, section: GeneratedSection): void {
    const hint = section.layoutHint || 'auto';

    // Section header slide
    if (hint === 'section-header' || hint === 'title') {
      this.renderSectionHeaderSlide(pptx, section);
      return;
    }

    // For auto or content hints, render content blocks into slides
    // Start with a section header, then content slides
    this.renderSectionHeaderSlide(pptx, section);

    for (const block of section.content) {
      this.renderContentBlock(pptx, section.heading, block);
    }
  }

  private renderSectionHeaderSlide(pptx: PptxGenJS, section: GeneratedSection): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08, fill: { color: BRAND.primary },
    });

    slide.addText(section.heading, {
      x: 0.8, y: 2.0, w: 8.4, h: 1.0,
      fontSize: 28, fontFace: FONT.heading, color: BRAND.primary,
      bold: true, align: 'center',
    });
  }

  private renderContentBlock(pptx: PptxGenJS, heading: string, block: GeneratedContent): void {
    switch (block.type) {
      case 'paragraph':
        this.renderParagraphSlide(pptx, heading, block.text);
        break;
      case 'bullet-list':
        this.renderBulletSlide(pptx, heading, block.items);
        break;
      case 'table':
        this.renderTableSlides(pptx, heading, block.headers, block.rows);
        break;
      case 'key-value':
        this.renderKeyValueSlide(pptx, heading, block.pairs);
        break;
    }
  }

  private renderParagraphSlide(pptx: PptxGenJS, heading: string, text: string): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
    this.addSlideTitle(slide, heading);

    slide.addText(text, {
      x: 0.8, y: 1.6, w: 8.4, h: 3.6,
      fontSize: 13, fontFace: FONT.body, color: BRAND.dark,
      valign: 'top',
    });
  }

  private renderBulletSlide(pptx: PptxGenJS, heading: string, items: string[]): void {
    const pageSize = 8;
    for (let i = 0; i < items.length; i += pageSize) {
      const page = items.slice(i, i + pageSize);
      const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(slide, i === 0 ? heading : `${heading} (cont.)`);

      const textRows = page.map(item => ({
        text: item,
        options: { fontSize: 13, fontFace: FONT.body, color: BRAND.dark, bullet: true, breakLine: true },
      }));

      slide.addText(textRows as any, {
        x: 0.8, y: 1.6, w: 8.4, h: 3.6,
        valign: 'top',
      });
    }
  }

  private renderTableSlides(pptx: PptxGenJS, heading: string, headers: string[], rows: string[][]): void {
    if (rows.length === 0) {
      const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(slide, heading);
      slide.addText('No data available.', {
        x: 0.8, y: 1.6, w: 8.4, h: 0.5,
        fontSize: 13, fontFace: FONT.body, color: BRAND.light, italic: true,
      });
      return;
    }

    const colCount = headers.length;
    const colW = colCount > 0 ? 9.0 / colCount : 2.0;

    const headerRow = headers.map(h => ({
      text: h,
      options: this.tableHeaderStyle(),
    }));

    const pageSize = 10;
    for (let i = 0; i < rows.length; i += pageSize) {
      const page = rows.slice(i, i + pageSize);
      const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
      this.addSlideTitle(slide, i === 0 ? heading : `${heading} (cont.)`);

      const tableRows: any[][] = [headerRow];
      page.forEach((row, idx) => {
        const bg = idx % 2 === 0 ? BRAND.white : BRAND.tableStripe;
        tableRows.push(row.map(cell => ({
          text: cell,
          options: this.tableCellStyle(bg),
        })));
      });

      slide.addTable(tableRows, {
        x: 0.5, y: 1.5, w: 9.0,
        border: { type: 'solid', pt: 0.5, color: BRAND.tableBorder },
        colW: Array(colCount).fill(colW),
        fontSize: 11,
        fontFace: FONT.body,
      });
    }
  }

  private renderKeyValueSlide(pptx: PptxGenJS, heading: string, pairs: { key: string; value: string }[]): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
    this.addSlideTitle(slide, heading);

    const leftLines = pairs.map(p => [
      { text: p.key, options: { fontSize: 12, bold: true, color: BRAND.medium, breakLine: false } },
      { text: `: ${p.value}`, options: { fontSize: 12, color: BRAND.dark, breakLine: true } },
    ]).flat();

    slide.addText(leftLines as any, {
      x: 0.8, y: 1.6, w: 8.4, h: 3.6,
      valign: 'top',
    });
  }

  private renderFooterSlide(pptx: PptxGenJS, metadata: ExportData): void {
    const slide = pptx.addSlide({ masterName: 'RQML_MASTER' });
    this.addSlideTitle(slide, 'Document Information');

    const lines = [
      `Document: ${metadata.title} (${metadata.docId})`,
      `Version: ${metadata.version}   Status: ${metadata.status}`,
      `Sections: ${metadata.sections.length}`,
      `Total items: ${metadata.sections.reduce((n, s) => n + s.items.length, 0)}`,
      `Trace edges: ${metadata.traceEdges.length}`,
    ];

    slide.addText(lines.join('\n'), {
      x: 0.8, y: 1.6, w: 8.4, h: 3.0,
      fontSize: 13, fontFace: FONT.body, color: BRAND.dark,
      valign: 'top',
    });

    slide.addText(`Generated by RQML · ${new Date().toLocaleDateString()}`, {
      x: 0.8, y: 5.0, w: 8.4, h: 0.3,
      fontSize: 9, fontFace: FONT.body, color: BRAND.light,
      align: 'center',
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

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

  private tableHeaderStyle() {
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
