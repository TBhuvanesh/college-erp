import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../errors/AppError';
import * as resultEntryTaskService from '../services/resultEntryTask.service';
import { listResultEntryTasksQuerySchema } from '../types/resultEntryTask';

// ── GET /api/result-entry-tasks (Faculty Results page: replaces subject dropdown) ──
export const listMyResultEntryTasks = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const filters = listResultEntryTasksQuerySchema.parse(req.query);
  const tasks = await resultEntryTaskService.listResultEntryTasks(user.id, user.role, filters);
  sendSuccess(res, { tasks });
});

// ── GET /api/result-entry-tasks/:id ──────────────────────────────────────────
export const getResultEntryTask = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const task = await resultEntryTaskService.getTaskById(req.params.id);
  if (user.role === 'faculty') {
    const facultyId = await resultEntryTaskService.resolveFacultyId(user.id);
    if (task.facultyId !== facultyId) {
      throw AppError.forbidden('You can only view your own result entry tasks', 'NOT_ASSIGNED');
    }
  } else if (user.role === 'student') {
    throw AppError.forbidden('Students do not have access to result entry tasks', 'STUDENT_DENIED');
  }
  sendSuccess(res, { task });
});

// ── POST /api/result-entry-tasks/:id/submit (Faculty: submit draft for approval) ──
export const submitTaskForApproval = asyncHandler(async (req: Request, res: Response) => {
  await resultEntryTaskService.submitForApproval(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Submitted for approval');
});

// ── POST /api/result-entry-tasks/:id/verify (HOD/Admin: optional verification stage) ──
export const verifyResultEntryTask = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin' && user.designation !== 'hod') {
    throw AppError.forbidden('Only admins or HODs can verify result entries', 'VERIFIER_ONLY');
  }
  await resultEntryTaskService.verifyTask(req.params.id, user.id);
  sendSuccess(res, null, 'Result entry verified');
});
