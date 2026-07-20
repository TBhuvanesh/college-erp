import { Router } from 'express';
import { z } from 'zod';
import * as studentController from '../controllers/student.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createStudentSchema,
  updateStudentSchema,
  updateStatusSchema,
  listStudentsQuerySchema,
  listSectionsQuerySchema,
} from '../types/student';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid student ID') }) };

// ── Student self-service ───────────────────────────────────────────────────────
// /me must be declared before /:id to prevent Express treating "me" as a UUID param
router.get(
  '/me',
  authenticate,
  requireRole('student'),
  studentController.getMyProfile
);

// ── Admin-only write operations ────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate({ body: createStudentSchema }),
  studentController.createStudent
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateStudentSchema }),
  studentController.updateStudent
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateStatusSchema }),
  studentController.updateStudentStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  studentController.deleteStudent
);

// ── Read operations ────────────────────────────────────────────────────────────
// List: admin, faculty and accountant only (students see their own via /me)
router.get(
  '/',
  authenticate,
  requireRole('admin', 'faculty', 'accountant'),
  validate({ query: listStudentsQuerySchema }),
  studentController.listStudents
);

// Distinct active sections for a department+semester — Mentorship's "Section
// Synchronization" source of truth. Declared before /:id so it isn't swallowed.
router.get(
  '/sections',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ query: listSectionsQuerySchema }),
  studentController.listSections
);

// Single student: admin, faculty, or the student themselves (access check in controller)
router.get(
  '/:id',
  authenticate,
  validate(uuidParam),
  studentController.getStudent
);

export default router;
