import type { Request, Response } from 'express';
import * as calendarService from '../services/academicCalendar.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  PublishEventsInput,
  UpdateCalendarEventInput,
  UpdateCalendarEventStatusInput,
  ListCalendarEventsQuery,
} from '../types/academicCalendar';
import type { Role } from '../types/roles';

// POST /api/calendar/publish
export const publishEvents = asyncHandler(async (req: Request, res: Response) => {
  const { parsedEventIds } = req.body as PublishEventsInput;
  const result = await calendarService.publishEvents(parsedEventIds, req.user!.id);
  const message = `Published ${result.published} event(s), skipped ${result.skipped}`;
  sendCreated(res, result, message);
});

// GET /api/calendar
export const listCalendarEvents = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListCalendarEventsQuery;
  const result  = await calendarService.listCalendarEvents(
    filters,
    req.user!.id,
    req.user!.role as Role
  );
  sendSuccess(res, result);
});

// GET /api/calendar/:id
export const getCalendarEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await calendarService.getCalendarEventById(
    req.params.id,
    req.user!.id,
    req.user!.role as Role
  );
  sendSuccess(res, { event });
});

// PATCH /api/calendar/:id
export const updateCalendarEvent = asyncHandler(async (req: Request, res: Response) => {
  const data  = req.body as UpdateCalendarEventInput;
  const event = await calendarService.updateCalendarEvent(req.params.id, data, req.user!.id);
  sendSuccess(res, { event }, 'Calendar event updated successfully');
});

// PATCH /api/calendar/:id/status
export const updateCalendarEventStatus = asyncHandler(async (req: Request, res: Response) => {
  const { publishStatus } = req.body as UpdateCalendarEventStatusInput;
  const event = await calendarService.updateCalendarEventStatus(
    req.params.id,
    publishStatus,
    req.user!.id
  );
  sendSuccess(res, { event }, `Calendar event ${publishStatus.toLowerCase()} successfully`);
});
