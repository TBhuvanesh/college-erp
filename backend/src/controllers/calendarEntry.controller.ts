import type { Request, Response } from 'express';
import * as calendarEntryService from '../services/calendarEntry.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateCalendarEntryInput, UpdateCalendarEntryInput, ListCalendarQuery } from '../types/calendarEntry';

export const createCalendarEntry = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateCalendarEntryInput;
  const entry = await calendarEntryService.createCalendarEntry(
    req.user!.id,
    req.user!.role,
    data
  );
  sendCreated(res, { entry }, 'Calendar entry created successfully');
});

export const listCalendarEntries = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListCalendarQuery;
  const result = await calendarEntryService.listCalendarEntries(
    req.user!.id,
    req.user!.role,
    filters
  );
  sendSuccess(res, result);
});

export const updateCalendarEntry = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateCalendarEntryInput;
  const entry = await calendarEntryService.updateCalendarEntry(
    req.user!.id,
    req.user!.role,
    req.params.id,
    data
  );
  sendSuccess(res, { entry }, 'Calendar entry updated successfully');
});

export const deleteCalendarEntry = asyncHandler(async (req: Request, res: Response) => {
  await calendarEntryService.deleteCalendarEntry(
    req.user!.id,
    req.user!.role,
    req.params.id
  );
  sendSuccess(res, null, 'Calendar entry deleted successfully');
});
