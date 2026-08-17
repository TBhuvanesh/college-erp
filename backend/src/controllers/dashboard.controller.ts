import type { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

// GET /api/dashboard/admin
export const adminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getAdminDashboardStats(req.user!.id);
  sendSuccess(res, stats);
});

// GET /api/dashboard/faculty/:userId?
export const facultyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const targetUserId = req.params.userId && req.params.userId !== 'my' ? req.params.userId : req.user!.id;
  const stats = await dashboardService.getFacultyDashboardStats(targetUserId);
  sendSuccess(res, stats);
});

// GET /api/dashboard/student/:userId?
export const studentDashboard = asyncHandler(async (req: Request, res: Response) => {
  const targetUserId = req.params.userId && req.params.userId !== 'my' ? req.params.userId : req.user!.id;
  const stats = await dashboardService.getStudentDashboardStats(targetUserId);
  sendSuccess(res, stats);
});

// GET /api/dashboard/hod/:userId?
export const hodDashboard = asyncHandler(async (req: Request, res: Response) => {
  const targetUserId = req.params.userId && req.params.userId !== 'my' ? req.params.userId : req.user!.id;
  const stats = await dashboardService.getHODDashboardStats(targetUserId);
  sendSuccess(res, stats);
});

// GET /api/dashboard/accountant
export const accountantDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await dashboardService.getAccountantDashboardStats();
  sendSuccess(res, stats);
});