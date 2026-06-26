import type { Request, Response } from 'express';
import * as resultService from '../services/result.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type {
  BulkSubmitResultsInput,
  UpdateResultInput,
  PublishResultsInput,
  ListResultsQuery,
} from '../types/result';

// ── Admin + Faculty: list with filters ────────────────────────────────────────

export const listResults = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListResultsQuery;

  // Faculty sees only results for subjects they teach
  if (req.user!.role === 'faculty') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (rows[0]) {
      (filters as ListResultsQuery & { facultyId?: string }).facultyId = rows[0].id;
    }
  }

  const result = await resultService.listResults(filters);
  sendSuccess(res, result);
});

// ── Admin + Faculty: single result ────────────────────────────────────────────

export const getResult = asyncHandler(async (req: Request, res: Response) => {
  const record = await resultService.getResultById(req.params.id);

  // Faculty: may only view results for subjects they submitted
  if (req.user!.role === 'faculty') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (!rows[0] || record.facultyId !== rows[0].id) {
      throw AppError.forbidden('You can only view results you have submitted');
    }
  }

  sendSuccess(res, { record });
});

// ── Faculty: roster + bulk submission ─────────────────────────────────────────

export const getRoster = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, section } = req.query as { subjectId?: string; section?: string };
  if (!subjectId || !section) {
    throw AppError.badRequest('Missing subjectId or section query parameters');
  }
  const roster = await resultService.getRoster(subjectId, section, req.user!.id);
  sendSuccess(res, { roster, total: roster.length });
});

export const bulkSubmitResults = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as BulkSubmitResultsInput;
  const result = await resultService.bulkSubmitResults(data, req.user!.id);
  sendCreated(
    res,
    result,
    `Results recorded — ${result.inserted} entries created, ${result.updated} updated`
  );
});

// ── Admin + Faculty: update single result ─────────────────────────────────────

export const updateResult = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateResultInput;
  const record = await resultService.updateResult(
    req.params.id,
    data,
    req.user!.id,
    req.user!.role
  );
  sendSuccess(res, { record }, 'Result updated successfully');
});

// ── Admin: publish batch ──────────────────────────────────────────────────────

export const publishResults = asyncHandler(async (req: Request, res: Response) => {
  const criteria = req.body as PublishResultsInput;
  const result = await resultService.publishResults(criteria, req.user!.id);
  sendSuccess(
    res,
    result,
    result.published > 0
      ? `${result.published} result(s) published successfully`
      : 'No draft results found to publish for the given criteria'
  );
});

// ── Admin: soft-delete ────────────────────────────────────────────────────────

export const deleteResult = asyncHandler(async (req: Request, res: Response) => {
  await resultService.deleteResult(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Result deleted successfully');
});

// ── Student: own results ──────────────────────────────────────────────────────

export const getMyResults = asyncHandler(async (req: Request, res: Response) => {
  const semester =
    req.query.semester !== undefined ? Number(req.query.semester) : undefined;
  const results = await resultService.getStudentResults(req.user!.id, semester);
  sendSuccess(res, { results, total: results.length });
});
