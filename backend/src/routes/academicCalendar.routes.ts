import { Router } from 'express';
import { z } from 'zod';
import * as calendarController from '../controllers/academicCalendar.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  publishEventsSchema,
  updateCalendarEventSchema,
  updateCalendarEventStatusSchema,
  listCalendarEventsQuerySchema,
} from '../types/academicCalendar';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid calendar event ID') }) };

// All calendar routes require authentication
router.use(authenticate);

// ── Admin-only write routes ────────────────────────────────────────────────────

// POST /api/calendar/publish
// Promotes approved candidate events into live calendar entries.
// Static path must come before /:id.
router.post(
  '/publish',
  requireRole('admin'),
  validate({ body: publishEventsSchema }),
  calendarController.publishEvents
);

// ── Read routes (all authenticated roles) ─────────────────────────────────────

// GET /api/calendar  (results are role-scoped inside the service)
router.get(
  '/',
  validate({ query: listCalendarEventsQuerySchema }),
  calendarController.listCalendarEvents
);

// ── Per-event routes (/publish is already handled above so /:id is safe here) ─

// PATCH /api/calendar/:id/status — archive or restore (admin only)
// /:id/status must come before /:id
router.patch(
  '/:id/status',
  requireRole('admin'),
  validate({ ...uuidParam, body: updateCalendarEventStatusSchema }),
  calendarController.updateCalendarEventStatus
);

// GET /api/calendar/:id  (role-scoped inside service)
router.get(
  '/:id',
  validate(uuidParam),
  calendarController.getCalendarEvent
);

// PATCH /api/calendar/:id — edit content (admin only)
router.patch(
  '/:id',
  requireRole('admin'),
  validate({ ...uuidParam, body: updateCalendarEventSchema }),
  calendarController.updateCalendarEvent
);

export default router;
