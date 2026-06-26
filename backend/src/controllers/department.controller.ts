import type { Request, Response } from 'express';
import * as departmentService from '../services/department.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export const listDepartments = asyncHandler(async (_req: Request, res: Response) => {
  const departments = await departmentService.getDepartments();
  sendSuccess(res, { departments });
});

export const getDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.getDepartmentById(req.params.id);
  sendSuccess(res, { department });
});

export const listPrograms = asyncHandler(async (req: Request, res: Response) => {
  const departmentId = req.query.departmentId as string | undefined;
  const programs = await departmentService.getPrograms(departmentId);
  sendSuccess(res, { programs });
});

export const getProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await departmentService.getProgramById(req.params.id);
  sendSuccess(res, { program });
});
