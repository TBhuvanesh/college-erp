import { Router } from 'express';
import { z } from 'zod';
import * as calendarEntryController from '../controllers/calendarEntry.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { createCalendarEntrySchema, updateCalendarEntrySchema, listCalendarQuerySchema } from '../types/calendarEntry';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid calendar entry ID') }) };

router.use(authenticate);

// GET /api/calendar-entries — all authenticated roles (scope enforced in service)
router.get(
  '/',
  validate({ query: listCalendarQuerySchema }),
  calendarEntryController.listCalendarEntries
);

// POST /api/calendar-entries — any authenticated user
router.post(
  '/',
  validate({ body: createCalendarEntrySchema }),
  calendarEntryController.createCalendarEntry
);

// PUT /api/calendar-entries/:id — creator or admin (enforced in service)
router.put(
  '/:id',
  validate({ params: uuidParam.params, body: updateCalendarEntrySchema }),
  calendarEntryController.updateCalendarEntry
);

// DELETE /api/calendar-entries/:id — creator or admin (enforced in service)
router.delete(
  '/:id',
  validate(uuidParam),
  calendarEntryController.deleteCalendarEntry
);

export default router;
