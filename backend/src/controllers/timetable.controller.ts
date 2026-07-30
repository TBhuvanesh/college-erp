import type { Request, Response } from 'express';
import * as timetableService from '../services/timetable.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { createTimetableSchema, updateTimetableSchema } from '../types/timetable';
import { AppError } from '../errors/AppError';

// POST /api/timetables
export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createTimetableSchema.parse(req.body);
  const result = await timetableService.createTimetable(data, req.user!.id);
  sendSuccess(res, result, 'Timetable created successfully');
});

// GET /api/timetables
export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    academicYear: req.query.academicYear as string,
    departmentId: req.query.departmentId as string,
    year: req.query.year as string,
    semester: req.query.semester ? Number(req.query.semester) : undefined,
    section: req.query.section as string,
    status: req.query.status as any,
  };
  const list = await timetableService.listTimetables(filters);
  sendSuccess(res, list);
});

// GET /api/timetables/student/active
export const getStudentActive = asyncHandler(async (req: Request, res: Response) => {
  const result = await timetableService.getTimetableForStudent(req.user!.id);
  sendSuccess(res, result);
});

// GET /api/timetables/faculty/schedule
export const getFacultySchedule = asyncHandler(async (req: Request, res: Response) => {
  const result = await timetableService.getTimetableForFaculty(req.user!.id);
  sendSuccess(res, result);
});

// GET /api/timetables/:id
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const result = await timetableService.getTimetableById(req.params.id);
  sendSuccess(res, result);
});

// PUT /api/timetables/:id
export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateTimetableSchema.parse(req.body);
  const result = await timetableService.updateTimetable(req.params.id, data, req.user!.id);
  sendSuccess(res, result, 'Timetable updated successfully');
});

// DELETE /api/timetables/:id
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await timetableService.deleteTimetable(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Timetable deleted successfully');
});

// POST /api/timetables/validate-input
export const validateInput = asyncHandler(async (req: Request, res: Response) => {
  const data = createTimetableSchema.parse(req.body);
  const excludeId = req.query.excludeId as string;
  const validationErrors = await timetableService.validateTimetableDetails(data, excludeId);
  sendSuccess(res, validationErrors);
});

// POST /api/timetables/:id/publish
export const publish = asyncHandler(async (req: Request, res: Response) => {
  const { effectiveFrom } = req.body;
  if (!effectiveFrom) {
    throw AppError.badRequest('effectiveFrom date is required to publish the timetable');
  }
  const result = await timetableService.publishTimetable(req.params.id, effectiveFrom, req.user!.id);
  sendSuccess(res, result, 'Timetable published successfully');
});
