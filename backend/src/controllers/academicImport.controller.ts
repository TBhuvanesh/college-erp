import type { Request, Response } from 'express';
import path from 'path';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../errors/AppError';
import * as importService from '../services/academicImport.service';
import * as studentSyncService from '../services/studentSync.service';
import { listSupportedImportEntityTypes } from '../import/strategyRegistry';
import { IMPORT_ENTITY_TYPES, IMPORT_MODES, commitImportSchema, listImportJobsQuerySchema } from '../types/academicImport';
import type { ImportEntityType, ImportMode } from '../types/academicImport';

function parseEntityType(raw: string): ImportEntityType {
  if (!IMPORT_ENTITY_TYPES.includes(raw as ImportEntityType)) {
    throw AppError.badRequest(`Unknown import entity type '${raw}'`, 'UNKNOWN_IMPORT_ENTITY_TYPE');
  }
  return raw as ImportEntityType;
}

function parseMode(raw: unknown): ImportMode {
  const mode = (raw as string) || 'merge';
  if (!IMPORT_MODES.includes(mode as ImportMode)) {
    throw AppError.badRequest(`Unknown import mode '${raw}'. Use 'merge' or 'replace'.`, 'UNKNOWN_IMPORT_MODE');
  }
  return mode as ImportMode;
}

// ── GET /api/academic-import/entity-types (which importers are implemented) ──
export const listEntityTypes = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { entityTypes: listSupportedImportEntityTypes(), allEntityTypes: IMPORT_ENTITY_TYPES });
});

// ── GET /api/academic-import/:entityType/replace-impact ──────────────────────
// Read-only counts of what Replace mode would delete — powers the
// confirmation dialog ("Display a confirmation dialog explaining exactly
// what will be removed"). Never mutates anything.
export const replaceImpact = asyncHandler(async (req: Request, res: Response) => {
  const entityType = parseEntityType(req.params.entityType);
  const impact = await importService.getReplaceImpact(entityType);
  sendSuccess(res, impact);
});

// ── POST /api/academic-import/:entityType/preview ────────────────────────────
// Parses + validates only — no database mutation. Admin only. `mode`
// (merge|replace, default merge) is form-data alongside the file, since it
// changes how existing-Roll-Number rows are categorized during validation.
export const preview = asyncHandler(async (req: Request, res: Response) => {
  const entityType = parseEntityType(req.params.entityType);
  const mode = parseMode(req.body?.mode);
  const file = req.file;
  if (!file) throw AppError.badRequest('No file uploaded. Attach the spreadsheet as field "file".', 'NO_FILE');

  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    throw AppError.badRequest('Only .xlsx, .xls, or .csv files are supported', 'UNSUPPORTED_FILE_TYPE');
  }

  const result = await importService.previewImport(entityType, file.buffer, ext, file.originalname, mode, req.user!.id);
  sendSuccess(res, result);
});

// ── POST /api/academic-import/:entityType/commit ─────────────────────────────
// Commits the rows the client echoes back from the preview response.
// Transactional, all-or-nothing (see ImportTransactionManager). Replace
// mode requires confirmReplace: true (validated by commitImportSchema) —
// the backend never trusts the frontend dialog alone for a destructive op.
export const commit = asyncHandler(async (req: Request, res: Response) => {
  const entityType = parseEntityType(req.params.entityType);
  const input = commitImportSchema.parse(req.body);

  const result = await importService.commitImport(entityType, input.jobId, input.rows, input.mode, req.user!.id);
  const message =
    input.mode === 'replace'
      ? `Replace complete — ${result.createdCount} student(s) imported after removing demo data.`
      : `${result.createdCount} created, ${result.updatedCount} updated`;
  sendCreated(res, result, message);
});

// ── GET /api/academic-import/jobs ─────────────────────────────────────────────
export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const filters = listImportJobsQuerySchema.parse(req.query);
  const result = await importService.listImportJobs(filters);
  sendSuccess(res, result);
});

// ── GET /api/academic-import/jobs/:jobId ──────────────────────────────────────
export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const job = await importService.getImportJob(req.params.jobId);
  sendSuccess(res, { job });
});

// ── Student Placement Sync (Nominal Rolls workbook sync) ──

// ── POST /api/academic-import/student-sync/preview ───────────────────────────
export const previewStudentSync = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw AppError.badRequest('No file uploaded. Attach the spreadsheet as field "file".', 'NO_FILE');

  const report = await studentSyncService.getSyncReport(file.buffer);
  sendSuccess(res, report);
});

// ── POST /api/academic-import/student-sync/commit ────────────────────────────
export const commitStudentSync = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const buffer = file ? file.buffer : undefined;
  
  const result = await studentSyncService.runPlacementSync(req.user!.id, buffer);
  sendSuccess(res, result, `${result.correctedCount} student placement(s) synchronized and corrected.`);
});
