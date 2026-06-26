import { Router } from 'express';
import { z } from 'zod';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createNotificationSchema, listNotificationsQuerySchema } from '../types/notification';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid notification ID') }) };

router.use(authenticate);

// GET /api/notifications/count — static route BEFORE /:id to prevent shadowing
router.get('/count', notificationController.getNotificationCount);

// GET /api/notifications — paginated, role-scoped
router.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  notificationController.listNotifications
);

// POST /api/notifications — admin always; faculty can target students only
router.post(
  '/',
  requireRole('admin', 'faculty'),
  validate({ body: createNotificationSchema }),
  notificationController.createNotification
);

// PUT /api/notifications/:id/read — mark read (any authenticated user)
// /:id/read must come before /:id
router.put('/:id/read',   validate(uuidParam), notificationController.markAsRead);
router.put('/:id/unread', validate(uuidParam), notificationController.markAsUnread);

export default router;
