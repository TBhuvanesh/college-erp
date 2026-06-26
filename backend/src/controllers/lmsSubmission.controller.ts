import fs from 'fs';
import type { Request, Response } from 'express';
import * as submissionService from '../services/lmsSubmission.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type {
  SubmitAssignmentInput,
  GradeSubmissionInput,
  ListSubmissionsQuery,
} from '../types/lms';

export const submitAssignment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw AppError.badRequest('No file uploaded', 'NO_FILE');
  const { assignmentId } = req.body as SubmitAssignmentInput;
  const submission = await submissionService.submitAssignment(req.user!.id, assignmentId, req.file);
  sendCreated(res, { submission }, 'Assignment submitted successfully');
});

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListSubmissionsQuery;
  const result = await submissionService.listSubmissions(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const getSubmission = asyncHandler(async (req: Request, res: Response) => {
  const submission = await submissionService.getSubmissionById(
    req.user!.id,
    req.user!.role,
    req.params.id
  );
  sendSuccess(res, { submission });
});

export const gradeSubmission = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as GradeSubmissionInput;
  const submission = await submissionService.gradeSubmission(req.user!.id, req.params.id, data);
  sendSuccess(res, { submission }, 'Submission graded successfully');
});

export const downloadSubmission = asyncHandler(async (req: Request, res: Response) => {
  const { filePath, fileName } = await submissionService.getSubmissionFilePath(
    req.user!.id,
    req.user!.role,
    req.params.id
  );
  if (!fs.existsSync(filePath)) throw AppError.notFound('File not found on server');
  res.download(filePath, fileName);
});
