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

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.createDepartment(req.user!.id, req.body);
  sendSuccess(res, { department }, 'Department created successfully', 201);
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentService.updateDepartment(req.user!.id, req.params.id, req.body);
  sendSuccess(res, { department }, 'Department updated successfully');
});

export const archiveDepartment = asyncHandler(async (req: Request, res: Response) => {
  await departmentService.archiveDepartment(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Department archived successfully');
});

export const restoreDepartment = asyncHandler(async (req: Request, res: Response) => {
  await departmentService.restoreDepartment(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Department restored successfully');
});

export const createProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await departmentService.createProgram(req.user!.id, req.body);
  sendSuccess(res, { program }, 'Program created successfully', 201);
});

export const updateProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await departmentService.updateProgram(req.user!.id, req.params.id, req.body);
  sendSuccess(res, { program }, 'Program updated successfully');
});

export const archiveProgram = asyncHandler(async (req: Request, res: Response) => {
  await departmentService.archiveProgram(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Program archived successfully');
});

export const restoreProgram = asyncHandler(async (req: Request, res: Response) => {
  await departmentService.restoreProgram(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Program restored successfully');
});
