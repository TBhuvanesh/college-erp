import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as academicPlanningService from '../services/academicPlanning.service';

export const getGaps = asyncHandler(async (req: Request, res: Response) => {
  const academicYear = (req.query.academicYear as string) || '2026-2027';
  const semester = req.query.semester ? Number(req.query.semester) : undefined;
  const departmentId = req.query.departmentId as string | undefined;
  const gaps = await academicPlanningService.analyzeGaps(academicYear, semester, departmentId);
  sendSuccess(res, gaps);
});

export const getFacultyCapacity = asyncHandler(async (req: Request, res: Response) => {
  const departmentId = req.query.departmentId as string | undefined;
  const academicYear = (req.query.academicYear as string) || '2026-2027';
  const capacity = await academicPlanningService.planFacultyCapacity(departmentId, academicYear);
  sendSuccess(res, { capacity });
});

export const generateTeachingAssignments = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { academicYear = '2026-2027', semester, departmentId, dryRun = true } = req.body ?? {};
  const result = await academicPlanningService.autoGenerateTeachingAssignments(academicYear, semester, departmentId, dryRun, user.id);
  sendSuccess(res, result);
});

export const generateMentors = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { departmentId, dryRun = true } = req.body ?? {};
  const result = await academicPlanningService.autoAssignMentors(departmentId, dryRun, user.id);
  sendSuccess(res, result);
});

export const getReport = asyncHandler(async (req: Request, res: Response) => {
  const academicYear = (req.query.academicYear as string) || '2026-2027';
  const semester = req.query.semester ? Number(req.query.semester) : undefined;
  const departmentId = req.query.departmentId as string | undefined;
  const report = await academicPlanningService.generateReport(academicYear, semester, departmentId);
  sendSuccess(res, report);
});
