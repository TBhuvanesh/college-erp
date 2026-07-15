import type { Request, Response } from 'express';
import * as examSessionService from '../services/examSession.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateExamSessionInput, UpdateExamSessionInput, ListExamSessionsQuery } from '../types/examSeating';

export const listExamSessions = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListExamSessionsQuery;
  const result = await examSessionService.listExamSessions(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const getExamSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await examSessionService.getExamSessionById(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, { session });
});

export const createExamSession = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateExamSessionInput;
  const session = await examSessionService.createExamSession(req.user!.id, req.user!.role, data);
  sendCreated(res, { session }, 'Exam session created successfully');
});

export const updateExamSession = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateExamSessionInput;
  const session = await examSessionService.updateExamSession(req.user!.id, req.user!.role, req.params.id, data);
  sendSuccess(res, { session }, 'Exam session updated successfully');
});

export const deleteExamSession = asyncHandler(async (req: Request, res: Response) => {
  await examSessionService.deleteExamSession(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, null, 'Exam session deleted successfully');
});

export const resolveExams = asyncHandler(async (req: Request, res: Response) => {
  const result = await examSessionService.resolveExams(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, result, 'Exams resolved successfully');
});

export const checkConflicts = asyncHandler(async (req: Request, res: Response) => {
  const result = await examSessionService.checkSessionConflicts(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, result);
});

export const generateSeating = asyncHandler(async (req: Request, res: Response) => {
  const result = await examSessionService.generateSessionSeating(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, result, 'Seating generated successfully');
});

export const generateInvigilation = asyncHandler(async (req: Request, res: Response) => {
  const duties = await examSessionService.generateSessionInvigilation(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, { duties }, 'Invigilation duties generated successfully');
});

export const validateExamSession = asyncHandler(async (req: Request, res: Response) => {
  const result = await examSessionService.validateExamSession(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, result, result.validated ? 'Exam session validated successfully' : 'Blocking conflicts must be resolved before validation');
});

export const publishExamSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await examSessionService.publishExamSession(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, { session }, 'Exam session published successfully');
});

export const completeExamSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await examSessionService.completeExamSession(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, { session }, 'Exam session marked as completed');
});

export const archiveExamSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await examSessionService.archiveExamSession(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, { session }, 'Exam session archived successfully');
});
