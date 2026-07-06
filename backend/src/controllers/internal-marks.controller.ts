import type { Request, Response } from 'express';
import * as marksService from '../services/internal-marks.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type {
  BulkEnterMarksInput,
  UpdateMarksInput,
  ListMarksQuery,
} from '../types/internal-marks';

// ── Faculty endpoints ─────────────────────────────────────────────────────────

export const getRoster = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, section, assessmentType } = req.query as any;
  if (!subjectId || !section || !assessmentType) {
    throw AppError.badRequest('Missing subjectId, section, or assessmentType query parameters');
  }
  const roster = await marksService.getRoster(subjectId, section, assessmentType, req.user!.id);
  sendSuccess(res, { roster, total: roster.length });
});

export const bulkEnterMarks = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as BulkEnterMarksInput;
  const result = await marksService.bulkEnterMarks(data, req.user!.id);
  sendCreated(
    res,
    result,
    `Marks recorded successfully — ${result.inserted} student entries created, ${result.updated} updated`
  );
});

// ── Shared (Admin + Faculty) endpoints ────────────────────────────────────────

export const getMarks = asyncHandler(async (req: Request, res: Response) => {
  const record = await marksService.getMarksById(req.params.id);

  // Faculty can only view records they originally marked
  if (req.user!.role === 'faculty') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (!rows[0] || record.facultyId !== rows[0].id) {
      throw AppError.forbidden('You can only view internal marks records you have entered');
    }
  }

  sendSuccess(res, { record });
});

export const updateMarks = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateMarksInput;
  const record = await marksService.updateMarks(
    req.params.id,
    data,
    req.user!.id,
    req.user!.role
  );
  sendSuccess(res, { record }, 'Internal marks record updated successfully');
});

export const listMarks = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListMarksQuery;

  // Faculty role scopes search records to only those they entered
  if (req.user!.role === 'faculty') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (rows[0]) {
      (filters as ListMarksQuery & { facultyId?: string }).facultyId = rows[0].id;
    }
  }

  const result = await marksService.listMarks(filters);
  sendSuccess(res, result);
});

// ── Student endpoints ─────────────────────────────────────────────────────────

export const getStudentSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await marksService.getStudentSummary(req.user!.id);
  sendSuccess(res, summary);
});

export const getStudentHistory = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as any;
  const result = await marksService.getStudentHistory(req.user!.id, filters);
  sendSuccess(res, result);
});
