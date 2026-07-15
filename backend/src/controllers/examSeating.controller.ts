import type { Request, Response } from 'express';
import * as examSeatingService from '../services/examSeating.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  GenerateSeatingInput,
  ListSlotsQuery,
  SwapSeatsInput,
  MoveSeatInput,
  LockSeatInput,
  SearchSeatingQuery,
} from '../types/examSeating';

export const getExamSlots = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListSlotsQuery;
  const slots = await examSeatingService.getExamSlots(req.user!.id, req.user!.role, filters);
  sendSuccess(res, { slots });
});

export const generateSeating = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as GenerateSeatingInput;
  const result = await examSeatingService.generateSeatingPlan(req.user!.id, req.user!.role, data);
  sendSuccess(res, result, 'Seating plan generated successfully');
});

export const checkConflicts = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as GenerateSeatingInput;
  const result = await examSeatingService.checkSeatingConflicts(req.user!.id, req.user!.role, {
    examIds: data.examIds,
    roomIds: data.roomIds,
  });
  sendSuccess(res, result);
});

export const getSeatingByExam = asyncHandler(async (req: Request, res: Response) => {
  const rooms = await examSeatingService.getSeatingByExam(req.user!.id, req.user!.role, req.params.examId);
  sendSuccess(res, { rooms });
});

export const getSeatingByRoom = asyncHandler(async (req: Request, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const chart = await examSeatingService.getSeatingByRoom(req.user!.id, req.user!.role, req.params.roomId, date);
  sendSuccess(res, { chart });
});

export const getMySeating = asyncHandler(async (req: Request, res: Response) => {
  const seats = await examSeatingService.getMySeating(req.user!.id);
  sendSuccess(res, { seats });
});

export const swapSeats = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as SwapSeatsInput;
  await examSeatingService.swapSeats(req.user!.id, req.user!.role, data);
  sendSuccess(res, null, 'Seats swapped successfully');
});

export const moveSeat = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as MoveSeatInput;
  const seat = await examSeatingService.moveSeat(req.user!.id, req.user!.role, data);
  sendSuccess(res, { seat }, 'Seat moved successfully');
});

export const lockSeat = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as LockSeatInput;
  const seat = await examSeatingService.lockSeat(req.user!.id, req.user!.role, req.params.id, data);
  sendSuccess(res, { seat }, 'Seat lock updated successfully');
});

export const searchSeating = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as SearchSeatingQuery;
  const results = await examSeatingService.searchSeating(req.user!.id, req.user!.role, filters);
  sendSuccess(res, { results });
});

export const getSeatingAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const examId = typeof req.query.examId === 'string' ? req.query.examId : undefined;
  const examSessionId = typeof req.query.examSessionId === 'string' ? req.query.examSessionId : undefined;
  const analytics = await examSeatingService.getSeatingAnalytics(req.user!.id, req.user!.role, { examId, examSessionId });
  sendSuccess(res, analytics);
});
