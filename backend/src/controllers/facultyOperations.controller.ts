import type { Request, Response } from 'express';
import * as facultyOperationsService from '../services/facultyOperations.service';
import { getWorkflowLogs } from '../services/workflowEngine.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { WorkloadQuery } from '../types/facultyOperations';
import type { ListWorkflowLogsQuery } from '../types/workflow';

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await facultyOperationsService.getFacultyOperationsDashboard(req.user!.id);
  sendSuccess(res, data);
});

export const getTasks = asyncHandler(async (req: Request, res: Response) => {
  const tasks = await facultyOperationsService.getFacultyTasksView(req.user!.id);
  sendSuccess(res, { tasks });
});

export const getWorkload = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as WorkloadQuery;
  const data = await facultyOperationsService.getWorkloadView(req.user!.id, req.user!.role, filters);
  sendSuccess(res, data);
});

export const getWorkflowLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListWorkflowLogsQuery;
  const data = await getWorkflowLogs(req.user!.id, req.user!.role, filters);
  sendSuccess(res, data);
});

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as { facultyId?: string };
  const data = await facultyOperationsService.getWorkloadAnalyticsView(req.user!.id, req.user!.role, filters);
  sendSuccess(res, data);
});
