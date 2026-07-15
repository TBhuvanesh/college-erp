import type { Request, Response } from 'express';
import * as experienceDashboardService from '../services/experienceDashboard.service';
import { buildStudentTimeline, buildFacultyTimeline } from '../services/timelineEngine.service';
import { buildStudentActions, buildFacultyActions } from '../services/actionEngine.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { DashboardWidgetsQuery } from '../types/experience';

const STUDENT_TIMELINE_WINDOW_DAYS = 14;

export const getStudentExperience = asyncHandler(async (req: Request, res: Response) => {
  const data = await experienceDashboardService.getStudentExperience(req.user!.id);
  sendSuccess(res, data);
});

export const getStudentTimeline = asyncHandler(async (req: Request, res: Response) => {
  const events = await buildStudentTimeline(req.user!.id, STUDENT_TIMELINE_WINDOW_DAYS);
  sendSuccess(res, { events });
});

export const getStudentActions = asyncHandler(async (req: Request, res: Response) => {
  const actions = await buildStudentActions(req.user!.id, STUDENT_TIMELINE_WINDOW_DAYS);
  sendSuccess(res, { actions });
});

export const getStudentWeek = asyncHandler(async (req: Request, res: Response) => {
  const week = await experienceDashboardService.getStudentWeek(req.user!.id);
  sendSuccess(res, week);
});

export const getFacultyExperience = asyncHandler(async (req: Request, res: Response) => {
  const data = await experienceDashboardService.getFacultyExperience(req.user!.id);
  sendSuccess(res, data);
});

export const getFacultyTimeline = asyncHandler(async (req: Request, res: Response) => {
  const events = await buildFacultyTimeline(req.user!.id);
  sendSuccess(res, { events });
});

export const getFacultyActions = asyncHandler(async (req: Request, res: Response) => {
  const actions = await buildFacultyActions(req.user!.id);
  sendSuccess(res, { actions });
});

export const getDashboardWidgets = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as DashboardWidgetsQuery;
  const widgets = await experienceDashboardService.getDashboardWidgets(req.user!.id, req.user!.role, filters);
  sendSuccess(res, { widgets });
});
