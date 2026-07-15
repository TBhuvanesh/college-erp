import type { Request, Response } from 'express';
import * as teachingPlanService from '../services/teachingPlan.service';
import * as roadmapService from '../services/teachingPlanRoadmap.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateTeachingPlanInput,
  UpdateTeachingPlanInput,
  UpdateLessonStatusInput,
  RescheduleTeachingPlanInput,
  ContinueLessonInput,
  ListTeachingPlansQuery,
  CourseProgressQuery,
  StudentScopedQuery,
  UpcomingQuery,
} from '../types/teachingPlan';

export const createTeachingPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateTeachingPlanInput;
  const teachingPlan = await teachingPlanService.createTeachingPlan(req.user!.id, data);
  sendCreated(res, { teachingPlan }, 'Teaching plan created successfully');
});

export const listTeachingPlans = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListTeachingPlansQuery;
  const result = await teachingPlanService.listTeachingPlans(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const getTeachingPlan = asyncHandler(async (req: Request, res: Response) => {
  const teachingPlan = await teachingPlanService.getTeachingPlanById(
    req.user!.id,
    req.user!.role,
    req.params.id
  );
  sendSuccess(res, { teachingPlan });
});

export const updateTeachingPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateTeachingPlanInput;
  const teachingPlan = await teachingPlanService.updateTeachingPlan(req.user!.id, req.params.id, data);
  sendSuccess(res, { teachingPlan }, 'Teaching plan updated successfully');
});

export const deleteTeachingPlan = asyncHandler(async (req: Request, res: Response) => {
  await teachingPlanService.deleteTeachingPlan(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Teaching plan deleted successfully');
});

// Lesson Progress Engine entry point.
export const updateLessonStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateLessonStatusInput;
  const result = await teachingPlanService.updateLessonStatus(req.user!.id, req.params.id, data);
  sendSuccess(res, result, 'Lesson status updated');
});

export const rescheduleTeachingPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as RescheduleTeachingPlanInput;
  const teachingPlan = await teachingPlanService.rescheduleLesson(req.user!.id, req.params.id, data);
  sendSuccess(res, { teachingPlan }, 'Lesson rescheduled successfully');
});

// Auto Shift Engine — explicit continuation-lesson creation.
export const continueLesson = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as ContinueLessonInput;
  const continuationLesson = await teachingPlanService.createContinuationLesson(req.user!.id, req.params.id, data);
  sendCreated(res, { continuationLesson }, 'Continuation lesson created successfully');
});

export const getStudentRoadmap = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as StudentScopedQuery;
  const roadmap = await roadmapService.getStudentRoadmap(req.user!.id, req.user!.role, filters);
  sendSuccess(res, roadmap);
});

export const getTodayLessons = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as StudentScopedQuery;
  const lessons = await roadmapService.getTodayLessons(req.user!.id, req.user!.role, filters);
  sendSuccess(res, { lessons });
});

export const getUpcomingLessons = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as UpcomingQuery;
  const result = await roadmapService.getUpcomingLessons(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const getCourseProgress = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as CourseProgressQuery;
  const progress = await roadmapService.getCourseProgress(req.user!.id, req.user!.role, filters);
  sendSuccess(res, { progress });
});
