import { Router } from 'express';
import { z } from 'zod';
import * as announcementController from '../controllers/announcement.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  updateAnnouncementStatusSchema,
  listAnnouncementsQuerySchema,
} from '../types/announcement';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid announcement ID') }) };

// ── Collection endpoints ───────────────────────────────────────────────────────

// All roles: list announcements (visibility is role-scoped in the service)
router.get(
  '/',
  authenticate,
  requireRole('admin', 'faculty', 'student'),
  validate({ query: listAnnouncementsQuerySchema }),
  announcementController.listAnnouncements
);

// Admin: create announcement (starts as Draft)
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate({ body: createAnnouncementSchema }),
  announcementController.createAnnouncement
);

// ── Individual endpoints (/:id/status before /:id to prevent ambiguity) ───────

// Admin: transition status (Draft ↔ Published ↔ Expired, no terminal states)
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateAnnouncementStatusSchema }),
  announcementController.updateAnnouncementStatus
);

// All roles: view single announcement (faculty/student: Published + visible only)
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty', 'student'),
  validate(uuidParam),
  announcementController.getAnnouncement
);

// Admin: update title, content, priority, dates (audience fields are immutable)
router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateAnnouncementSchema }),
  announcementController.updateAnnouncement
);

// Admin: soft-delete
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  announcementController.deleteAnnouncement
);

export default router;
