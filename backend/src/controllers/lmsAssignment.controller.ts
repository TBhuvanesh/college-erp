import type { Request, Response } from 'express';
import * as assignmentService from '../services/lmsAssignment.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ListAssignmentsQuery,
} from '../types/lms';

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateAssignmentInput;
  const assignment = await assignmentService.createAssignment(req.user!.id, data);
  sendCreated(res, { assignment }, 'Assignment created successfully');
});

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListAssignmentsQuery;
  const result = await assignmentService.listAssignments(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const getAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentService.getAssignmentById(
    req.user!.id,
    req.user!.role,
    req.params.id
  );
  sendSuccess(res, { assignment });
});

export const updateAssignment = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateAssignmentInput;
  const assignment = await assignmentService.updateAssignment(req.user!.id, req.params.id, data);
  sendSuccess(res, { assignment }, 'Assignment updated successfully');
});

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  await assignmentService.deleteAssignment(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Assignment deleted successfully');
});
