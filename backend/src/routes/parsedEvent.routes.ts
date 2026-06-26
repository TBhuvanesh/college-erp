import { Router } from 'express';
import { z } from 'zod';
import * as parsedEventController from '../controllers/parsedEvent.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  updateParsedEventSchema,
  updateParsedEventStatusSchema,
  listParsedEventsQuerySchema,
} from '../types/parsedEvent';

const router = Router();

const uuidParam       = { params: z.object({ id: z.string().uuid('Invalid event ID') }) };
const docUuidParam    = { params: z.object({ documentId: z.string().uuid('Invalid document ID') }) };

// All parsed-event endpoints are admin-only
router.use(authenticate, requireRole('admin'));

// ── Static / non-id routes (must come before /:id) ───────────────────────────

// POST /api/parsed-events/extract/:documentId
// Triggers rule-based extraction on a document's extracted_text
router.post(
  '/extract/:documentId',
  validate(docUuidParam),
  parsedEventController.extractFromDocument
);

// ── Collection endpoints ──────────────────────────────────────────────────────

// GET /api/parsed-events  (filter by documentId, status, eventType, audience, dates)
router.get(
  '/',
  validate({ query: listParsedEventsQuerySchema }),
  parsedEventController.listParsedEvents
);

// ── Individual endpoints (/:id/status before /:id) ────────────────────────────

// PATCH /api/parsed-events/:id/status  →  Approve / Reject / reset to Pending
router.patch(
  '/:id/status',
  validate({ ...uuidParam, body: updateParsedEventStatusSchema }),
  parsedEventController.updateParsedEventStatus
);

// GET /api/parsed-events/:id
router.get(
  '/:id',
  validate(uuidParam),
  parsedEventController.getParsedEvent
);

// PATCH /api/parsed-events/:id  →  edit fields (auto-transitions to Edited)
router.patch(
  '/:id',
  validate({ ...uuidParam, body: updateParsedEventSchema }),
  parsedEventController.updateParsedEvent
);

// DELETE /api/parsed-events/:id
router.delete(
  '/:id',
  validate(uuidParam),
  parsedEventController.deleteParsedEvent
);

export default router;
