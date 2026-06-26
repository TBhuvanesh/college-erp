import { Router } from 'express';
import { z } from 'zod';
import * as facultyController from '../controllers/faculty.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createFacultySchema,
  updateFacultySchema,
  updateFacultyStatusSchema,
  listFacultyQuerySchema,
} from '../types/faculty';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid faculty ID') }) };

// ── Faculty self-service ───────────────────────────────────────────────────────
// /me must be declared before /:id to prevent Express treating "me" as a UUID param
router.get(
  '/me',
  authenticate,
  requireRole('faculty'),
  facultyController.getMyProfile
);

// ── Admin-only write operations ────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate({ body: createFacultySchema }),
  facultyController.createFaculty
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateFacultySchema }),
  facultyController.updateFaculty
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateFacultyStatusSchema }),
  facultyController.updateFacultyStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  facultyController.deleteFaculty
);

// ── Read operations ────────────────────────────────────────────────────────────
// List and single read: admin and faculty only (students have no need to browse faculty)
router.get(
  '/',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ query: listFacultyQuerySchema }),
  facultyController.listFaculty
);

router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate(uuidParam),
  facultyController.getFaculty
);

export default router;
