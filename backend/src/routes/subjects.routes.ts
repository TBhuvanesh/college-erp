import { Router } from 'express';
import { z } from 'zod';
import * as subjectController from '../controllers/subject.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createSubjectSchema,
  updateSubjectSchema,
  updateSubjectStatusSchema,
  listSubjectsQuerySchema,
} from '../types/subject';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid subject ID') }) };

// ── Admin-only write operations ────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate({ body: createSubjectSchema }),
  subjectController.createSubject
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateSubjectSchema }),
  subjectController.updateSubject
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateSubjectStatusSchema }),
  subjectController.updateSubjectStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  subjectController.deleteSubject
);

// ── Read operations — accessible to all authenticated roles ────────────────────
// subjects:read permission covers admin, faculty, student (see types/roles.ts)
router.get(
  '/',
  authenticate,
  validate({ query: listSubjectsQuerySchema }),
  subjectController.listSubjects
);

router.get(
  '/:id',
  authenticate,
  validate(uuidParam),
  subjectController.getSubject
);

export default router;
