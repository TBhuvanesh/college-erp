import type { Request, Response } from 'express';
import * as subjectService from '../services/subject.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  UpdateSubjectStatusInput,
  ListSubjectsQuery,
} from '../types/subject';

export const createSubject = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateSubjectInput;
  const subject = await subjectService.createSubject(data, req.user!.id);
  sendCreated(res, { subject }, 'Subject created successfully');
});

export const listSubjects = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListSubjectsQuery;
  const result = await subjectService.listSubjects(filters);
  sendSuccess(res, result);
});

export const getSubject = asyncHandler(async (req: Request, res: Response) => {
  const subject = await subjectService.getSubjectById(req.params.id);
  sendSuccess(res, { subject });
});

export const updateSubject = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateSubjectInput;
  const subject = await subjectService.updateSubject(req.params.id, data, req.user!.id);
  sendSuccess(res, { subject }, 'Subject updated successfully');
});

export const updateSubjectStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateSubjectStatusInput;
  const subject = await subjectService.updateSubjectStatus(req.params.id, data, req.user!.id);
  sendSuccess(res, { subject }, `Subject status updated to '${data.status}'`);
});

export const deleteSubject = asyncHandler(async (req: Request, res: Response) => {
  await subjectService.deleteSubject(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Subject archived successfully');
});
