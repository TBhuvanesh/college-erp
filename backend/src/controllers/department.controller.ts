import type { Request, Response } from 'express';
import * as departmentService from '../services/department.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { UpdateDepartmentColorInput } from '../services/department.service';

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

export const updateDepartmentColor = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateDepartmentColorInput;
  const department = await departmentService.updateDepartmentColor(req.user!.id, req.params.id, data);
  sendSuccess(res, { department }, 'Department color updated successfully');
});
