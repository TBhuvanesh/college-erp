import type { Request, Response } from 'express';
import * as facultyService from '../services/faculty.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateFacultyInput,
  UpdateFacultyInput,
  UpdateFacultyStatusInput,
  ListFacultyQuery,
} from '../types/faculty';

export const createFaculty = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateFacultyInput;
  const faculty = await facultyService.createFaculty(data, req.user!.id);
  sendCreated(res, { faculty }, 'Faculty member created successfully');
});

export const listFaculty = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListFacultyQuery;
  const result = await facultyService.listFaculty(filters);
  sendSuccess(res, result);
});

export const getFaculty = asyncHandler(async (req: Request, res: Response) => {
  const faculty = await facultyService.getFacultyById(req.params.id);
  sendSuccess(res, { faculty });
});

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const faculty = await facultyService.getFacultyByUserId(req.user!.id);
  sendSuccess(res, { faculty });
});

export const updateFaculty = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateFacultyInput;
  const faculty = await facultyService.updateFaculty(req.params.id, data, req.user!.id);
  sendSuccess(res, { faculty }, 'Faculty member updated successfully');
});

export const updateFacultyStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateFacultyStatusInput;
  const faculty = await facultyService.updateFacultyStatus(req.params.id, data, req.user!.id);
  sendSuccess(res, { faculty }, `Faculty status updated to '${data.status}'`);
});

export const deleteFaculty = asyncHandler(async (req: Request, res: Response) => {
  await facultyService.deleteFaculty(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Faculty member deactivated successfully');
});
