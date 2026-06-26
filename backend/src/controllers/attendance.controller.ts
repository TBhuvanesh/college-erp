import type { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import * as assignmentService from '../services/assignment.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type {
  MarkAttendanceInput,
  UpdateAttendanceInput,
  ListAttendanceQuery,
  RosterQuery,
  HistoryQuery,
} from '../types/attendance';
import type {
  CreateAssignmentInput,
  ListAssignmentsQuery,
} from '../types/assignment';

// ── Assignment management (admin) ─────────────────────────────────────────────

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateAssignmentInput;
  const assignment = await assignmentService.createAssignment(data, req.user!.id);
  sendCreated(res, { assignment }, 'Assignment created successfully');
});

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListAssignmentsQuery;
  const assignments = await assignmentService.listAssignments(filters);
  sendSuccess(res, { assignments });
});

export const getAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentService.getAssignmentById(req.params.assignmentId);
  sendSuccess(res, { assignment });
});

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  await assignmentService.deleteAssignment(req.params.assignmentId, req.user!.id);
  sendSuccess(res, null, 'Assignment removed successfully');
});

// ── Faculty: view own assignments ─────────────────────────────────────────────

export const getMyAssignments = asyncHandler(async (req: Request, res: Response) => {
  // Resolve users.id → faculty.id → assignments
  const { rows } = await (await import('../config/database')).query<{ id: string }>(
    'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [req.user!.id]
  );
  if (!rows[0]) throw AppError.forbidden('No faculty profile is linked to this account');

  const academicYear = req.query.academicYear as string | undefined;
  const assignments = await assignmentService.getAssignmentsByFacultyId(rows[0].id, academicYear);
  sendSuccess(res, { assignments });
});

// ── Faculty: roster and marking ───────────────────────────────────────────────

export const getRoster = asyncHandler(async (req: Request, res: Response) => {
  const { subjectId, section, date } = req.query as unknown as RosterQuery;
  const roster = await attendanceService.getRoster(subjectId, section, date);
  sendSuccess(res, { roster, total: roster.length });
});

export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as MarkAttendanceInput;
  const result = await attendanceService.markAttendance(data, req.user!.id);
  sendCreated(
    res,
    result,
    `Attendance marked — ${result.inserted} new, ${result.updated} updated`
  );
});

// ── Shared: single record and update ─────────────────────────────────────────

export const getAttendance = asyncHandler(async (req: Request, res: Response) => {
  const record = await attendanceService.getAttendanceById(req.params.id);

  // Faculty can only view records for subjects they teach (faculty_id matches)
  if (req.user!.role === 'faculty') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (!rows[0] || record.facultyId !== rows[0].id) {
      throw AppError.forbidden('You can only view attendance records you have marked');
    }
  }

  sendSuccess(res, { record });
});

export const updateAttendance = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateAttendanceInput;
  const record = await attendanceService.updateAttendance(
    req.params.id,
    data,
    req.user!.id,
    req.user!.role
  );
  sendSuccess(res, { record }, 'Attendance record updated');
});

// ── Admin: list with filters ──────────────────────────────────────────────────

export const listAttendance = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListAttendanceQuery;

  // Faculty automatically scoped to records they marked
  if (req.user!.role === 'faculty') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (rows[0]) {
      (filters as ListAttendanceQuery & { facultyId?: string }).facultyId = rows[0].id;
    }
  }

  const result = await attendanceService.listAttendance(filters);
  sendSuccess(res, result);
});

// ── Student: summary and history ──────────────────────────────────────────────

export const getStudentSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await attendanceService.getStudentSummary(req.user!.id);
  sendSuccess(res, summary);
});

export const getStudentHistory = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as HistoryQuery;
  const result = await attendanceService.getStudentHistory(req.user!.id, filters);
  sendSuccess(res, result);
});
