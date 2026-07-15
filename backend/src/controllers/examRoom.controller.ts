import type { Request, Response } from 'express';
import * as examRoomService from '../services/examRoom.service';
import * as resourceAvailabilityService from '../services/resourceAvailability.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateExamRoomInput,
  UpdateExamRoomInput,
  ListExamRoomsQuery,
  AvailabilityQuery,
  RoomSuggestionQuery,
} from '../types/examSeating';

export const listExamRooms = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListExamRoomsQuery;
  const rooms = await examRoomService.listExamRooms(filters);
  sendSuccess(res, { rooms });
});

export const getExamRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await examRoomService.getExamRoomById(req.params.id);
  sendSuccess(res, { room });
});

export const createExamRoom = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateExamRoomInput;
  const room = await examRoomService.createExamRoom(req.user!.id, data);
  sendCreated(res, { room }, 'Exam room created successfully');
});

export const updateExamRoom = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateExamRoomInput;
  const room = await examRoomService.updateExamRoom(req.user!.id, req.params.id, data);
  sendSuccess(res, { room }, 'Exam room updated successfully');
});

export const deleteExamRoom = asyncHandler(async (req: Request, res: Response) => {
  await examRoomService.deleteExamRoom(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Exam room deleted successfully');
});

// ── Resource Availability Engine ─────────────────────────────────────────────

export const listRoomAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { date, startTime, endTime } = req.query as unknown as AvailabilityQuery;
  const rooms = await examRoomService.listExamRoomsWithAvailability(date, startTime, endTime);
  sendSuccess(res, { rooms });
});

export const suggestRooms = asyncHandler(async (req: Request, res: Response) => {
  const { date, startTime, endTime, requiredCapacity } = req.query as unknown as RoomSuggestionQuery;
  const result = await resourceAvailabilityService.suggestRooms(requiredCapacity, date, startTime, endTime);
  sendSuccess(res, result);
});
