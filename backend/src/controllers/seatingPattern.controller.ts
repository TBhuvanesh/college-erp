import type { Request, Response } from 'express';
import * as seatingPatternService from '../services/seatingPattern.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateSeatingPatternInput, UpdateSeatingPatternInput, ListSeatingPatternsQuery } from '../types/examSeating';

export const listSeatingPatterns = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListSeatingPatternsQuery;
  const patterns = await seatingPatternService.listSeatingPatterns(filters);
  sendSuccess(res, { patterns });
});

export const getSeatingPattern = asyncHandler(async (req: Request, res: Response) => {
  const pattern = await seatingPatternService.getSeatingPatternById(req.params.id);
  sendSuccess(res, { pattern });
});

export const createSeatingPattern = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateSeatingPatternInput;
  const pattern = await seatingPatternService.createSeatingPattern(req.user!.id, data);
  sendCreated(res, { pattern }, 'Seating pattern created successfully');
});

export const updateSeatingPattern = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateSeatingPatternInput;
  const pattern = await seatingPatternService.updateSeatingPattern(req.user!.id, req.params.id, data);
  sendSuccess(res, { pattern }, 'Seating pattern updated successfully');
});

export const deleteSeatingPattern = asyncHandler(async (req: Request, res: Response) => {
  await seatingPatternService.deleteSeatingPattern(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Seating pattern deleted successfully');
});
