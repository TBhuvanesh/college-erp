import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { ReportResult } from '../types/report';

// Safety cap — a PDF/Excel export is a rendering convenience, not a bulk data
// dump; callers needing more should paginate the underlying JSON report instead.
const EXPORT_ROW_CAP = 5000;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ── CSV ────────────────────────────────────────────────────────────────────────

export function sendCsv(res: Response, filename: string, report: ReportResult): void {
  const escape = (val: unknown): string => {
    const str = formatCell(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = report.columns.map((c) => escape(c.label)).join(',');
  const lines = report.rows
    .slice(0, EXPORT_ROW_CAP)
    .map((row) => report.columns.map((c) => escape(row[c.key])).join(','));
  const csv = [header, ...lines].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  // UTF-8 BOM so Excel opens non-ASCII text correctly.
  res.send('﻿' + csv);
}

// ── Excel ──────────────────────────────────────────────────────────────────────

export async function sendExcel(res: Response, filename: string, report: ReportResult): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP Academic Analytics & Reports';
  workbook.created = new Date();

  if (report.summary && Object.keys(report.summary).length > 0) {
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 24 },
    ];
    summarySheet.getRow(1).font = { bold: true };
    for (const [key, value] of Object.entries(report.summary)) {
      summarySheet.addRow({ metric: key, value: formatCell(value) });
    }
  }

  const dataSheet = workbook.addWorksheet((report.title || 'Report').slice(0, 31));
  dataSheet.columns = report.columns.map((c) => ({ header: c.label, key: c.key, width: 22 }));
  dataSheet.getRow(1).font = { bold: true };
  for (const row of report.rows.slice(0, EXPORT_ROW_CAP)) {
    const flatRow: Record<string, string> = {};
    for (const c of report.columns) flatRow[c.key] = formatCell(row[c.key]);
    dataSheet.addRow(flatRow);
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

// ── PDF ────────────────────────────────────────────────────────────────────────

export function sendPdf(res: Response, filename: string, report: ReportResult): void {
  const landscape = report.columns.length > 6;
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(report.title || 'Report', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('gray').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown();

  if (report.summary && Object.keys(report.summary).length > 0) {
    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(9);
    for (const [key, value] of Object.entries(report.summary)) {
      doc.text(`${key}: ${formatCell(value)}`);
    }
    doc.moveDown();
  }

  doc.fontSize(12).text('Data', { underline: true });
  doc.moveDown(0.3);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / Math.max(report.columns.length, 1);
  const rowHeight = 14;

  const drawRow = (values: string[], bold: boolean) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
    }
    const y = doc.y;
    doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    values.forEach((val, i) => {
      doc.text(val, doc.page.margins.left + i * colWidth, y, { width: colWidth - 4, ellipsis: true, lineBreak: false });
    });
    doc.y = y + rowHeight;
  };

  drawRow(report.columns.map((c) => c.label), true);
  const rows = report.rows.slice(0, EXPORT_ROW_CAP);
  for (const row of rows) {
    drawRow(report.columns.map((c) => formatCell(row[c.key])), false);
  }
  if (report.rows.length > EXPORT_ROW_CAP) {
    doc.moveDown().fontSize(8).fillColor('gray').text(
      `… ${report.rows.length - EXPORT_ROW_CAP} more rows omitted. Export as Excel/CSV or paginate the JSON report for full data.`
    );
  }

  doc.end();
}
