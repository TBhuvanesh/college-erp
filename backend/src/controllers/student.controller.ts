import type { Request, Response } from 'express';
import * as studentService from '../services/student.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type {
  CreateStudentInput,
  UpdateStudentInput,
  UpdateStatusInput,
  ListStudentsQuery,
} from '../types/student';

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateStudentInput;
  const student = await studentService.createStudent(data, req.user!.id);
  sendCreated(res, { student }, 'Student created successfully');
});

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListStudentsQuery;
  if (req.user?.role === 'faculty' && req.user?.designation === 'hod') {
    filters.departmentId = req.user.departmentId;
  }
  const result = await studentService.listStudents(filters);
  sendSuccess(res, result);
});

export const getStudent = asyncHandler(async (req: Request, res: Response) => {
  const student = await studentService.getStudentById(req.params.id);

  // Students can only view their own profile
  if (req.user!.role === 'student' && student.userId !== req.user!.id) {
    throw AppError.forbidden('Students can only view their own profile');
  }

  // HODs can only view students in their own department
  if (req.user?.role === 'faculty' && req.user?.designation === 'hod' && student.department.id !== req.user.departmentId) {
    throw AppError.forbidden('HODs can only view students in their own department');
  }

  sendSuccess(res, { student });
});

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const student = await studentService.getStudentByUserId(req.user!.id);
  sendSuccess(res, { student });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateStudentInput;
  const student = await studentService.updateStudent(req.params.id, data, req.user!.id);
  sendSuccess(res, { student }, 'Student updated successfully');
});

export const updateStudentStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateStatusInput;
  const student = await studentService.updateStudentStatus(req.params.id, data, req.user!.id);
  sendSuccess(res, { student }, `Student status updated to '${data.status}'`);
});

export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  await studentService.deleteStudent(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Student deactivated successfully');
});
