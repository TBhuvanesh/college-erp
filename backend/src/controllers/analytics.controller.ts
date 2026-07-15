import type { Request, Response } from 'express';
import * as analyticsService from '../services/analytics.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { AdminAnalyticsQuery } from '../types/analytics';

export const getAdminAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as AdminAnalyticsQuery;
  const data = await analyticsService.getAdminAnalytics(req.user!.id, filters);
  sendSuccess(res, data);
});

export const getHodAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getHodAnalytics(req.user!.id);
  sendSuccess(res, data);
});

export const getFacultyAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getFacultyAnalytics(req.user!.id);
  sendSuccess(res, data);
});

export const getStudentAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getStudentAnalytics(req.user!.id);
  sendSuccess(res, data);
});
