import { Router } from 'express';
import { z } from 'zod';
import * as marksController from '../controllers/internal-marks.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  bulkEnterMarksSchema,
  updateMarksSchema,
  listMarksQuerySchema,
} from '../types/internal-marks';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid marks record ID') }) };

// ── Faculty: marks entry and roster ───────────────────────────────────────────

router.get(
  '/roster',
  authenticate,
  requireRole('faculty'),
  marksController.getRoster
);

router.post(
  '/sessions',
  authenticate,
  requireRole('faculty'),
  validate({ body: bulkEnterMarksSchema }),
  marksController.bulkEnterMarks
);

// ── Student: summary and history logs ─────────────────────────────────────────

router.get(
  '/summary',
  authenticate,
  requireRole('student'),
  marksController.getStudentSummary
);

router.get(
  '/history',
  authenticate,
  requireRole('student'),
  marksController.getStudentHistory
);

// ── Shared (Admin + Faculty): search registry list ───────────────────────────

router.get(
  '/',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ query: listMarksQuerySchema }),
  marksController.listMarks
);

router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate(uuidParam),
  marksController.getMarks
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ ...uuidParam, body: updateMarksSchema }),
  marksController.updateMarks
);

export default router;
