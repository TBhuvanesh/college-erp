import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import * as teachingAssignmentService from '../services/teachingAssignment.service';
import {
  createTeachingAssignmentSchema,
  updateTeachingAssignmentSchema,
  transferTeachingAssignmentSchema,
  deleteTeachingAssignmentSchema,
  listTeachingAssignmentsQuerySchema,
  ResolveSubjectsForAssignmentQuery,
} from '../types/teachingAssignment';

async function getFacultyProfile(userId: string) {
  const { rows } = await query<{ id: string; department_id: string; designation: string | null }>(
    'SELECT id, department_id, designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return rows[0] || null;
}

// ── GET /api/teaching-assignments (Search & Filter) ──────────────────────────
export const listTeachingAssignments = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const filters = req.query as any;

  if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to teaching assignments', 'STUDENT_DENIED');
  }

  if (user.role === 'faculty') {
    const profile = await getFacultyProfile(user.id);
    if (!profile) {
      throw AppError.forbidden('No active faculty profile linked to this account', 'PROFILE_MISSING');
    }

    const isHod = profile.designation === 'hod';
    if (isHod) {
      filters.departmentId = profile.department_id;
    } else {
      filters.facultyId = profile.id;
    }
  }

  const parsedFilters = listTeachingAssignmentsQuerySchema.parse(filters);
  const teachingAssignments = await teachingAssignmentService.getAllocations(parsedFilters);
  sendSuccess(res, { teachingAssignments });
});

// ── GET /api/teaching-assignments/my (Faculty Dashboard: "My Teaching Assignments") ──
// This is the endpoint that replaces manual subject selection everywhere a
// faculty member needs to pick "which of my subjects/sections" — Teaching
// Planner, Attendance, LMS, Results all point here instead of independently
// querying faculty_subject_assignments/subjects.
export const getMyTeachingAssignments = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'faculty') {
    throw AppError.forbidden('Only faculty accounts have teaching assignments', 'FACULTY_ONLY');
  }
  const profile = await getFacultyProfile(user.id);
  if (!profile) {
    throw AppError.forbidden('No active faculty profile linked to this account', 'PROFILE_MISSING');
  }
  const academicYear = req.query.academicYear as string | undefined;
  const teachingAssignments = await teachingAssignmentService.resolveMyTeachingAssignments(profile.id, academicYear);
  sendSuccess(res, { teachingAssignments });
});

// ── GET /api/teaching-assignments/:id (Detail) ────────────────────────────────
export const getTeachingAssignment = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const teachingAssignment = await teachingAssignmentService.getAllocationById(id);

  if (user.role === 'faculty') {
    const profile = await getFacultyProfile(user.id);
    if (!profile) {
      throw AppError.forbidden('No active faculty profile linked to this account', 'PROFILE_MISSING');
    }

    const isHod = profile.designation === 'hod';
    if (isHod) {
      if (teachingAssignment.departmentId !== profile.department_id) {
        throw AppError.forbidden('HODs can only view teaching assignments within their department', 'DEPARTMENT_FORBIDDEN');
      }
    } else if (teachingAssignment.facultyId !== profile.id) {
      throw AppError.forbidden('Faculty members can only view their own teaching assignments', 'ALLOCATION_FORBIDDEN');
    }
  } else if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to teaching assignments', 'STUDENT_DENIED');
  }

  sendSuccess(res, { teachingAssignment });
});

// ── POST /api/teaching-assignments (Create) ───────────────────────────────────
export const createTeachingAssignment = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can create teaching assignments', 'ADMIN_ONLY');
  }

  const input = createTeachingAssignmentSchema.parse(req.body);
  const { allocation, warning } = await teachingAssignmentService.createAllocation(input, user.id);

  sendCreated(res, { teachingAssignment: allocation, warning }, 'Teaching assignment created successfully');
});

// ── PUT /api/teaching-assignments/:id (Edit) ──────────────────────────────────
export const updateTeachingAssignment = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can update teaching assignments', 'ADMIN_ONLY');
  }

  const { id } = req.params;
  const input = updateTeachingAssignmentSchema.parse(req.body);
  const { allocation, warning } = await teachingAssignmentService.updateAllocation(id, input, user.id);

  sendSuccess(res, { teachingAssignment: allocation, warning }, 'Teaching assignment updated successfully');
});

// ── POST /api/teaching-assignments/:id/transfer (Transfer) ───────────────────
export const transferTeachingAssignment = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can transfer teaching assignments', 'ADMIN_ONLY');
  }

  const { id } = req.params;
  const { facultyId } = transferTeachingAssignmentSchema.parse(req.body);
  const { allocation, warning } = await teachingAssignmentService.transferAllocation(id, facultyId, user.id);

  sendSuccess(res, { teachingAssignment: allocation, warning }, 'Teaching assignment transferred successfully');
});

// ── DELETE /api/teaching-assignments/:id (Remove with history/reason) ───────
export const deleteTeachingAssignment = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can delete teaching assignments', 'ADMIN_ONLY');
  }

  const { id } = req.params;
  const { reason } = deleteTeachingAssignmentSchema.parse(req.body);
  await teachingAssignmentService.deleteAllocation(id, reason, user.id);

  sendSuccess(res, null, 'Teaching assignment removed successfully');
});

// ── GET /api/teaching-assignments/workload-overview (Part 1: Faculty Teaching Load) ──
// One row per faculty (expandable to subjects/labs/tutorials) instead of one
// row per assignment — computed from teaching_assignments + subjects' L-T-P
// hours + configured Theory/Lab/Tutorial weights.
export const getFacultyWorkloadOverview = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to faculty workload data', 'STUDENT_DENIED');
  }
  const academicYear = (req.query.academicYear as string) || '2026-2027';
  const overview = await teachingAssignmentService.getFacultyWorkloadOverview(academicYear);
  sendSuccess(res, overview);
});

// ── GET /api/teaching-assignments/statistics (Workload Dashboard Stats) ─────
export const getStatistics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to workload statistics', 'STUDENT_DENIED');
  }

  const academicYear = (req.query.academicYear as string) || '2026-2027';
  const statistics = await teachingAssignmentService.getWorkloadStatistics(academicYear);

  sendSuccess(res, { statistics });
});

// ── GET /api/teaching-assignments/subject/:subjectId/profile ────────────────
export const getSubjectProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to subject profile details', 'STUDENT_DENIED');
  }

  const { subjectId } = req.params;
  const profile = await teachingAssignmentService.getSubjectProfile(subjectId);

  sendSuccess(res, { profile });
});

// ── GET /api/teaching-assignments/subjects (Resolve subjects for assignment) ──
export const resolveSubjectsForAssignment = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ResolveSubjectsForAssignmentQuery;
  const result = await teachingAssignmentService.resolveSubjectsForAssignment(filters);
  sendSuccess(res, result);
});
