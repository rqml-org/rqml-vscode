// XLSX generation using ExcelJS
// Renders LLM-generated content into an Excel workbook

import ExcelJS from 'exceljs';
import type { ExportGenerator, ExportData } from './types';
import type { GeneratedReport, GeneratedContent } from '../schemas/reportOutput';

const BRAND = {
  primary: '2B579A',
  headerText: 'FFFFFF',
  stripe: 'F0F4FA',
};

export class XlsxGenerator implements ExportGenerator {
  async generate(report: GeneratedReport, metadata: ExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RQML Export';
    workbook.title = report.title;
    workbook.created = new Date();

    for (const section of report.sections) {
      // Sanitize sheet name (max 31 chars, no special chars)
      const sheetName = section.heading.replace(/[\\/*?[\]:]/g, '').slice(0, 31);
      const ws = workbook.addWorksheet(sheetName);

      let rowNum = 1;

      // Section heading
      const titleRow = ws.getRow(rowNum);
      titleRow.getCell(1).value = section.heading;
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: `FF${BRAND.primary}` } };
      rowNum += 2;

      for (const block of section.content) {
        rowNum = this.renderContent(ws, block, rowNum);
      }

      // Auto-fit columns (approximate)
      ws.columns?.forEach(col => {
        if (col.values) {
          let maxLen = 10;
          col.values.forEach(v => {
            if (v && String(v).length > maxLen) maxLen = String(v).length;
          });
          col.width = Math.min(maxLen + 2, 50);
        }
      });
    }

    // Add metadata sheet
    const metaWs = workbook.addWorksheet('Document Info');
    metaWs.getRow(1).values = ['Property', 'Value'];
    this.styleHeaderRow(metaWs, 1, 2);
    metaWs.getRow(2).values = ['Title', metadata.title];
    metaWs.getRow(3).values = ['Document ID', metadata.docId];
    metaWs.getRow(4).values = ['Version', metadata.version];
    metaWs.getRow(5).values = ['Status', metadata.status];
    metaWs.getRow(6).values = ['Sections', String(metadata.sections.length)];
    metaWs.getRow(7).values = ['Generated', new Date().toLocaleDateString()];
    metaWs.getColumn(1).width = 20;
    metaWs.getColumn(2).width = 40;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private renderContent(ws: ExcelJS.Worksheet, block: GeneratedContent, startRow: number): number {
    switch (block.type) {
      case 'paragraph':
        return this.renderParagraph(ws, block.text, startRow);
      case 'bullet-list':
        return this.renderBulletList(ws, block.items, startRow);
      case 'table':
        return this.renderTable(ws, block.headers, block.rows, startRow);
      case 'key-value':
        return this.renderKeyValue(ws, block.pairs, startRow);
    }
  }

  private renderParagraph(ws: ExcelJS.Worksheet, text: string, startRow: number): number {
    const cleaned = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1');
    const row = ws.getRow(startRow);
    row.getCell(1).value = cleaned;
    row.getCell(1).alignment = { wrapText: true };
    return startRow + 2;
  }

  private renderBulletList(ws: ExcelJS.Worksheet, items: string[], startRow: number): number {
    let row = startRow;
    for (const item of items) {
      ws.getRow(row).getCell(1).value = `• ${item}`;
      row++;
    }
    return row + 1;
  }

  private renderTable(ws: ExcelJS.Worksheet, headers: string[], rows: string[][], startRow: number): number {
    let row = startRow;

    // Header row
    const headerRow = ws.getRow(row);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    this.styleHeaderRow(ws, row, headers.length);
    row++;

    // Data rows
    for (let r = 0; r < rows.length; r++) {
      const dataRow = ws.getRow(row);
      rows[r].forEach((cell, i) => {
        dataRow.getCell(i + 1).value = cell;
      });

      // Striped rows
      if (r % 2 === 1) {
        for (let i = 1; i <= headers.length; i++) {
          dataRow.getCell(i).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${BRAND.stripe}` },
          };
        }
      }
      row++;
    }

    return row + 1;
  }

  private renderKeyValue(ws: ExcelJS.Worksheet, pairs: { key: string; value: string }[], startRow: number): number {
    let row = startRow;
    for (const p of pairs) {
      const r = ws.getRow(row);
      r.getCell(1).value = p.key;
      r.getCell(1).font = { bold: true };
      r.getCell(2).value = p.value;
      row++;
    }
    return row + 1;
  }

  private styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, colCount: number): void {
    const row = ws.getRow(rowNum);
    for (let i = 1; i <= colCount; i++) {
      const cell = row.getCell(i);
      cell.font = { bold: true, color: { argb: `FF${BRAND.headerText}` } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${BRAND.primary}` },
      };
    }
  }
}
