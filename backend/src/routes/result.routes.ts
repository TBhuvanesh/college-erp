import { Router } from 'express';
import { z } from 'zod';
import * as resultController from '../controllers/result.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  bulkSubmitResultsSchema,
  updateResultSchema,
  publishResultsSchema,
  listResultsQuerySchema,
} from '../types/result';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid result ID') }) };

// ── Static paths before /:id ───────────────────────────────────────────────────

// Faculty: roster for a subject+section (pre-populated with existing results)
router.get(
  '/roster',
  authenticate,
  requireRole('faculty'),
  resultController.getRoster
);

// Faculty: bulk submit external marks for a section
router.post(
  '/sessions',
  authenticate,
  requireRole('faculty'),
  validate({ body: bulkSubmitResultsSchema }),
  resultController.bulkSubmitResults
);

// Admin: publish all Draft results for a subject+section
router.post(
  '/publish',
  authenticate,
  requireRole('admin'),
  validate({ body: publishResultsSchema }),
  resultController.publishResults
);

// Student: own Published results (optionally filtered by ?semester=N)
router.get(
  '/my-results',
  authenticate,
  requireRole('student'),
  resultController.getMyResults
);

// ── Collection endpoints ───────────────────────────────────────────────────────

// Admin + Faculty: list results with optional filters
router.get(
  '/',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ query: listResultsQuerySchema }),
  resultController.listResults
);

// ── Individual result endpoints (/:id last) ────────────────────────────────────

// Admin + Faculty: view a single result
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate(uuidParam),
  resultController.getResult
);

// Admin + Faculty: update marks (grade and status recomputed automatically)
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ ...uuidParam, body: updateResultSchema }),
  resultController.updateResult
);

// Admin: soft-delete
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  resultController.deleteResult
);

export default router;
