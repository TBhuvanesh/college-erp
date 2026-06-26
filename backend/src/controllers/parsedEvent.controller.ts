import type { Request, Response } from 'express';
import * as parsedEventService from '../services/parsedEvent.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  UpdateParsedEventInput,
  UpdateParsedEventStatusInput,
  ListParsedEventsQuery,
} from '../types/parsedEvent';

// POST /api/parsed-events/extract/:documentId
export const extractFromDocument = asyncHandler(async (req: Request, res: Response) => {
  const result = await parsedEventService.parseDocument(req.params.documentId, req.user!.id);
  sendCreated(res, result, `Extracted ${result.created} candidate event(s)`);
});

// GET /api/parsed-events
export const listParsedEvents = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListParsedEventsQuery;
  const result = await parsedEventService.listParsedEvents(filters);
  sendSuccess(res, result);
});

// GET /api/parsed-events/:id
export const getParsedEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await parsedEventService.getParsedEventById(req.params.id);
  sendSuccess(res, { event });
});

// PATCH /api/parsed-events/:id
export const updateParsedEvent = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateParsedEventInput;
  const event = await parsedEventService.updateParsedEvent(req.params.id, data, req.user!.id);
  sendSuccess(res, { event }, 'Event updated successfully');
});

// PATCH /api/parsed-events/:id/status
export const updateParsedEventStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as UpdateParsedEventStatusInput;
  const event = await parsedEventService.updateParsedEventStatus(req.params.id, status, req.user!.id);
  sendSuccess(res, { event }, `Event ${status.toLowerCase()} successfully`);
});

// DELETE /api/parsed-events/:id
export const deleteParsedEvent = asyncHandler(async (req: Request, res: Response) => {
  await parsedEventService.deleteParsedEvent(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Event deleted successfully');
});
