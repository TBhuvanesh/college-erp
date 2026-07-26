import ExcelJS from 'exceljs';
import { Readable } from 'stream';

// Generic Excel/CSV → row-object parser, shared by every import strategy.
// Extracted from the header-normalization + cell-reading logic that already
// worked for subjectImport.service.ts, generalized so a strategy only needs
// to declare its expected headers instead of re-implementing cell parsing.

export interface ParsedSheet {
  /** Normalized header (lowercase, no whitespace) → 1-based column index. */
  columnMap: Record<string, number>;
  /** One entry per non-empty data row (row 2 onward), 1-based row numbers preserved. */
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
}

function getCellValueString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if ('richText' in cell.value) {
      return (cell.value as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('').trim();
    }
    if ('text' in cell.value) {
      return String((cell.value as { text: unknown }).text).trim();
    }
    if (cell.value instanceof Date) {
      return cell.value.toISOString().split('T')[0];
    }
  }
  return String(cell.value).trim();
}

/** Normalizes a header cell value to a lookup key: lowercase, alphanumeric characters only. */
export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses an uploaded workbook buffer (.xlsx/.xls/.csv) into a normalized
 * column map plus row objects keyed by every recognized header — a strategy
 * then resolves the specific columns it cares about via `columnMap` and
 * reads `cells[normalizedHeader]` for each row.
 */
export async function parseSpreadsheet(buffer: Buffer, fileExtension: string): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();

  if (fileExtension === 'csv') {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Spreadsheet does not contain any worksheets.');
  }

  // Dynamically detect the header row by scanning the first 15 rows for known column headers
  let headerRowIndex = 1;
  let maxMatchedHeaders = 0;
  const knownAliases = new Set([
    'rollnumber', 'roll', 'htno', 'hallticketnumber', 'rollno',
    'studentname', 'name', 'fullname',
    'email', 'emailaddress', 'studentemail', 'emailid',
    'studentmobile', 'mobilenumber', 'mobile', 'phone', 'phonenumber', 'studentphone', 'studentmobileno',
    'department', 'dept', 'branch', 'yrbrsc',
    'section', 'sec', 'ectio'
  ]);

  for (let r = 1; r <= Math.min(worksheet.rowCount, 15); r++) {
    const row = worksheet.getRow(r);
    let matchedCount = 0;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const normalized = normalizeHeader(getCellValueString(cell));
      if (normalized && knownAliases.has(normalized)) {
        matchedCount++;
      }
    });
    if (matchedCount > maxMatchedHeaders) {
      maxMatchedHeaders = matchedCount;
      headerRowIndex = r;
    }
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  const columnMap: Record<string, number> = {};
  const headerNames: Record<number, string> = {};
  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(getCellValueString(cell));
    if (normalized) {
      columnMap[normalized] = colNumber;
      headerNames[colNumber] = normalized;
    }
  });

  const rows: ParsedSheet['rows'] = [];
  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const cells: Record<string, string> = {};
    let hasValues = false;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headerNames[colNumber];
      if (!header) return;
      const value = getCellValueString(cell);
      if (value !== '') hasValues = true;
      cells[header] = value;
    });

    if (!hasValues) continue; // skip fully empty rows
    rows.push({ rowNumber: r, cells });
  }

  return { columnMap, rows };
}

/**
 * Validates that every required header (given as arrays of accepted aliases,
 * e.g. `['rollnumber','roll']`) is present in the parsed column map. Returns
 * the human-readable labels of any missing headers.
 */
export function findMissingHeaders(
  columnMap: Record<string, number>,
  required: Array<{ label: string; aliases: string[] }>
): string[] {
  return required
    .filter((req) => !req.aliases.some((alias) => columnMap[alias] !== undefined))
    .map((req) => req.label);
}

/** Reads the first matching alias's value for a row, or '' if none present. */
export function cell(row: { cells: Record<string, string> }, aliases: string[]): string {
  for (const alias of aliases) {
    if (row.cells[alias] !== undefined) return row.cells[alias];
  }
  return '';
}
