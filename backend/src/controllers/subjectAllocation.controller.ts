import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import * as allocationService from '../services/subjectAllocation.service';
import {
  createAllocationSchema,
  updateAllocationSchema,
  transferAllocationSchema,
  deleteAllocationSchema,
  listAllocationsQuerySchema,
} from '../types/subjectAllocation';

// Helper to retrieve active faculty profile linked to user account
async function getFacultyProfile(userId: string) {
  const { rows } = await query<{ id: string; department_id: string; designation: string | null }>(
    'SELECT id, department_id, designation FROM faculty WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return rows[0] || null;
}

// ── GET /api/subject-allocations (Search & Filter) ───────────────────────────
export const listAllocations = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const filters = req.query as any;

  // Apply Role-Based Access controls
  if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to subject allocations', 'STUDENT_DENIED');
  }

  if (user.role === 'faculty') {
    const profile = await getFacultyProfile(user.id);
    if (!profile) {
      throw AppError.forbidden('No active faculty profile linked to this account', 'PROFILE_MISSING');
    }

    const isHod = profile.designation === 'hod';
    if (isHod) {
      // HOD: Read department allocations only
      filters.departmentId = profile.department_id;
    } else {
      // Standard Faculty: Read only, Only their own allocations
      filters.facultyId = profile.id;
    }
  }

  // Admin and accountant pass through with query parameters intact
  const parsedFilters = listAllocationsQuerySchema.parse(filters);
  const allocations = await allocationService.getAllocations(parsedFilters);
  sendSuccess(res, { allocations });
});

// ── GET /api/subject-allocations/:id (Detail) ─────────────────────────────────
export const getAllocation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const allocation = await allocationService.getAllocationById(id);

  // Apply Faculty-level resource protection
  if (user.role === 'faculty') {
    const profile = await getFacultyProfile(user.id);
    if (!profile) {
      throw AppError.forbidden('No active faculty profile linked to this account', 'PROFILE_MISSING');
    }

    const isHod = profile.designation === 'hod';
    if (isHod) {
      if (allocation.departmentId !== profile.department_id) {
        throw AppError.forbidden('HODs can only view allocations within their department', 'DEPARTMENT_FORBIDDEN');
      }
    } else {
      if (allocation.facultyId !== profile.id) {
        throw AppError.forbidden('Faculty members can only view their own allocations', 'ALLOCATION_FORBIDDEN');
      }
    }
  } else if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to subject allocations', 'STUDENT_DENIED');
  }

  sendSuccess(res, { allocation });
});

// ── POST /api/subject-allocations (Create) ────────────────────────────────────
export const createAllocation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can create subject allocations', 'ADMIN_ONLY');
  }

  const input = createAllocationSchema.parse(req.body);
  const { allocation, warning } = await allocationService.createAllocation(input, user.id);

  sendCreated(res, { allocation, warning }, 'Subject allocation created successfully');
});

// ── PUT /api/subject-allocations/:id (Edit) ───────────────────────────────────
export const updateAllocation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can update subject allocations', 'ADMIN_ONLY');
  }

  const { id } = req.params;
  const input = updateAllocationSchema.parse(req.body);
  const { allocation, warning } = await allocationService.updateAllocation(id, input, user.id);

  sendSuccess(res, { allocation, warning }, 'Subject allocation updated successfully');
});

// ── POST /api/subject-allocations/:id/transfer (Transfer) ──────────────────────
export const transferAllocation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can transfer subject allocations', 'ADMIN_ONLY');
  }

  const { id } = req.params;
  const { facultyId } = transferAllocationSchema.parse(req.body);
  const { allocation, warning } = await allocationService.transferAllocation(id, facultyId, user.id);

  sendSuccess(res, { allocation, warning }, 'Subject allocation transferred successfully');
});

// ── DELETE /api/subject-allocations/:id (Remove with history/reason) ──────────
export const deleteAllocation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can delete subject allocations', 'ADMIN_ONLY');
  }

  const { id } = req.params;
  const { reason } = deleteAllocationSchema.parse(req.body);
  await allocationService.deleteAllocation(id, reason, user.id);

  sendSuccess(res, null, 'Subject allocation removed successfully');
});

// ── GET /api/subject-allocations/statistics (Workload Dashboard Stats) ──────────
export const getStatistics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to workload statistics', 'STUDENT_DENIED');
  }

  const academicYear = (req.query.academicYear as string) || '2026-2027';
  const statistics = await allocationService.getWorkloadStatistics(academicYear);

  sendSuccess(res, { statistics });
});

// ── GET /api/subject-allocations/subject/:subjectId/profile (Subject Profile integration) ──────────
export const getSubjectProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to subject profile details', 'STUDENT_DENIED');
  }

  const { subjectId } = req.params;
  const profile = await allocationService.getSubjectProfile(subjectId);

  sendSuccess(res, { profile });
});
