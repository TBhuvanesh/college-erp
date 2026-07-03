import type { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

// GET /api/dashboard/admin
export const adminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getAdminDashboardStats(req.user!.id);
  sendSuccess(res, stats);
});

// GET /api/dashboard/faculty
export const facultyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getFacultyDashboardStats(req.user!.id);
  sendSuccess(res, stats);
});

// GET /api/dashboard/student
export const studentDashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getStudentDashboardStats(req.user!.id);
  sendSuccess(res, stats);
});

// GET /api/dashboard/hod
export const hodDashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getHODDashboardStats(req.user!.id);
  sendSuccess(res, stats);
});