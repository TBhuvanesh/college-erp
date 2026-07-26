import { AppError } from '../errors/AppError';
import { parseSpreadsheet, findMissingHeaders } from './ExcelParser';
import type { ImportStrategy, ActionedRow } from './ImportStrategy';
import { summarize } from './ImportStrategy';
import type { ImportSummary, ImportRowError, ImportMode } from '../types/academicImport';

// Entity-agnostic: parse → header check → per-strategy row validation →
// distribution/summary build. Every future importer runs through this exact
// pipeline; only the strategy passed in differs.

export interface PipelineResult<TValidRow> {
  validRows: ActionedRow<TValidRow>[];
  invalidRows: ImportRowError[];
  summary: ImportSummary;
  totalRows: number;
}

export async function runValidationPipeline<TValidRow>(
  strategy: ImportStrategy<TValidRow>,
  fileBuffer: Buffer,
  fileExtension: string,
  mode: ImportMode
): Promise<PipelineResult<TValidRow>> {
  const sheet = await parseSpreadsheet(fileBuffer, fileExtension);

  const missingHeaders = findMissingHeaders(sheet.columnMap, strategy.requiredHeaders);
  if (missingHeaders.length > 0) {
    throw AppError.badRequest(
      `Invalid spreadsheet template. Missing required column(s): ${missingHeaders.join(', ')}`,
      'MISSING_REQUIRED_HEADERS'
    );
  }

  if (sheet.rows.length === 0) {
    throw AppError.badRequest('The spreadsheet contains no data rows to import', 'EMPTY_SPREADSHEET');
  }

  // Columns the strategy recognizes by name but deliberately never imports
  // (Aadhaar/Government ID/Address, ...) — reported so the admin sees why a
  // column they can see in their sheet doesn't show up anywhere in the ERP,
  // instead of it silently vanishing.
  const ignoredColumns = strategy.ignoredHeaders
    .filter((h) => h.aliases.some((alias) => sheet.columnMap[alias] !== undefined))
    .map((h) => h.label);

  const result = await strategy.validateRows(sheet, mode);
  const distributions = strategy.buildDistributions(result.validRows);
  const summary = summarize(sheet.rows.length, result, distributions, ignoredColumns);

  return { validRows: result.validRows, invalidRows: result.invalidRows, summary, totalRows: sheet.rows.length };
}
