import type { Request, Response } from 'express';
import * as subjectService from '../services/subject.service';
import * as importService from '../services/subjectImport.service';
import * as exportService from '../services/export.service';
import { AppError } from '../errors/AppError';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { ReportResult } from '../types/report';
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  UpdateSubjectStatusInput,
  ListSubjectsQuery,
  CreateCurriculumMappingInput,
  UpdateCurriculumMappingInput,
} from '../types/subject';

// ── Manual CRUD: Create ────────────────────────────────────────────────────────
export const createSubject = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateSubjectInput;
  const subject = await subjectService.createSubject(data, req.user!.id);
  sendCreated(res, { subject }, 'Subject created successfully');
});

// ── Manual CRUD: List ──────────────────────────────────────────────────────────
export const listSubjects = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListSubjectsQuery;
  
  // HODs: Read department allocations/subjects only
  if (req.user?.role === 'faculty' && req.user?.designation === 'hod') {
    filters.departmentId = req.user.departmentId;
  }
  
  const result = await subjectService.listSubjects(filters);
  sendSuccess(res, result);
});

// ── Manual CRUD: Get Details ───────────────────────────────────────────────────
export const getSubject = asyncHandler(async (req: Request, res: Response) => {
  const subject = await subjectService.getSubjectById(req.params.id);

  // HODs: restricted to their department
  if (req.user?.role === 'faculty' && req.user?.designation === 'hod') {
    const hasAccess = subject.mappings.some(m => m.departmentId === req.user?.departmentId);
    if (!hasAccess) {
      throw AppError.forbidden('HODs can only view subjects in their own department');
    }
  }

  sendSuccess(res, { subject });
});

// ── Manual CRUD: Update ────────────────────────────────────────────────────────
export const updateSubject = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateSubjectInput;
  const subject = await subjectService.updateSubject(req.params.id, data, req.user!.id);
  sendSuccess(res, { subject }, 'Subject updated successfully');
});

// ── Manual CRUD: Update Status (Active/Inactive) ──────────────────────────────
export const updateSubjectStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateSubjectStatusInput;
  const subject = await subjectService.updateSubjectStatus(req.params.id, data, req.user!.id);
  sendSuccess(res, { subject }, `Subject status updated to '${data.status}'`);
});

// ── Manual CRUD: Delete (Soft Delete with active usage check) ──────────────────
export const deleteSubject = asyncHandler(async (req: Request, res: Response) => {
  await subjectService.deleteSubject(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Subject archived successfully');
});

// ── Curriculum Mapping Operations ──────────────────────────────────────────────
export const createCurriculumMapping = asyncHandler(async (req: Request, res: Response) => {
  const { id: subjectId } = req.params;
  const data = req.body as CreateCurriculumMappingInput;
  const mappingId = await subjectService.createCurriculumMapping(subjectId, data, req.user!.id);
  const subject = await subjectService.getSubjectById(subjectId);
  sendSuccess(res, { mappingId, subject }, 'Curriculum mapping added successfully');
});

export const updateCurriculumMapping = asyncHandler(async (req: Request, res: Response) => {
  const { mappingId } = req.params;
  const data = req.body as UpdateCurriculumMappingInput;
  const subject = await subjectService.updateCurriculumMapping(mappingId, data, req.user!.id);
  sendSuccess(res, { subject }, 'Curriculum mapping updated successfully');
});

export const deleteCurriculumMapping = asyncHandler(async (req: Request, res: Response) => {
  const { mappingId } = req.params;
  const subject = await subjectService.deleteCurriculumMapping(mappingId, req.user!.id);
  sendSuccess(res, { subject }, 'Curriculum mapping removed successfully');
});

// ── Spreadsheet Operations: Preview upload before import ─────────────────────
export const importPreview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw AppError.badRequest('Please upload an Excel or CSV file.', 'FILE_REQUIRED');
  }

  const extension = req.file.originalname.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
    throw AppError.badRequest('Unsupported file format. Please upload .xlsx, .xls, or .csv', 'INVALID_FILE_TYPE');
  }

  const preview = await importService.parseSubjectSpreadsheet(req.file.buffer, extension);
  sendSuccess(res, { preview }, 'Spreadsheet parsed successfully.');
});

// ── Spreadsheet Operations: Commit Excel Import ──────────────────────────────
export const importCommit = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) {
    throw AppError.badRequest('Missing parsed row data list.', 'ROWS_REQUIRED');
  }

  const summary = await importService.commitImportedSubjects(rows, req.user!.id);
  sendSuccess(res, summary, `Successfully processed import of ${summary.rowsProcessed} curriculum rows.`);
});

// ── Spreadsheet Operations: Export to Excel/CSV/PDF ───────────────────────────
export const exportSubjects = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as any;
  
  // HODs: restricted to their department
  if (req.user?.role === 'faculty' && req.user?.designation === 'hod') {
    filters.departmentId = req.user.departmentId;
  }

  // Load matching subjects list (safety cap at 5000 rows)
  const result = await subjectService.listSubjects({
    ...filters,
    page: 1,
    limit: 5000,
  });

  const columns = [
    { key: 'code', label: 'Subject Code' },
    { key: 'name', label: 'Subject Name' },
    { key: 'departmentName', label: 'Department' },
    { key: 'programName', label: 'Program' },
    { key: 'regulation', label: 'Regulation' },
    { key: 'year', label: 'Year' },
    { key: 'semesterRaw', label: 'Semester' },
    { key: 'credits', label: 'Credits' },
    { key: 'lectureHours', label: 'L' },
    { key: 'tutorialHours', label: 'T' },
    { key: 'practicalHours', label: 'P' },
    { key: 'type', label: 'Subject Type' },
    { key: 'status', label: 'Status' },
  ];

  // Helper formatting for subjects mapped to multiple departments
  const formattedRows = result.subjects.map((sub: any) => ({
    ...sub,
    departmentName: sub.departmentName || sub.mappings?.map((m: any) => m.departmentCode).join(', ') || 'N/A',
    programName: sub.programName || sub.mappings?.map((m: any) => m.programName).filter(Boolean).join(', ') || 'N/A',
    regulation: sub.regulation || sub.mappings?.map((m: any) => m.regulation).join(', ') || 'N/A',
    year: sub.year || sub.mappings?.map((m: any) => m.year).join(', ') || 'N/A',
    semesterRaw: sub.semesterRaw || sub.mappings?.map((m: any) => m.semesterRaw).filter(Boolean).join(', ') || 'N/A',
  }));

  const report: ReportResult = {
    title: 'Subjects Master Catalog',
    columns,
    rows: formattedRows,
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
  };

  const format = (req.query.format as string) || 'xlsx';
  const filename = `subjects_master_${new Date().toISOString().slice(0, 10)}`;

  if (format === 'csv') {
    exportService.sendCsv(res, filename, report);
  } else if (format === 'pdf') {
    exportService.sendPdf(res, filename, report);
  } else {
    await exportService.sendExcel(res, filename, report);
  }
});

// ── Bulk operations: Wipe out all unused subject master records ────────────────
export const deleteAllSubjects = asyncHandler(async (req: Request, res: Response) => {
  const result = await subjectService.deleteAllSubjects(req.user!.id);
  sendSuccess(
    res,
    result,
    `Wiped all ${result.deletedCount} subjects from the catalog successfully.`
  );
});
