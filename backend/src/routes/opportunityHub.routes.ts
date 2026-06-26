import { Router } from 'express';
import { z } from 'zod';
import * as opportunityController from '../controllers/opportunityHub.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  listOpportunitiesQuerySchema,
} from '../types/opportunityHub';

const router = Router();

const uuidParam   = { params: z.object({ id: z.string().uuid('Invalid opportunity ID') }) };
const pageQuery   = { query: z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}) };

router.use(authenticate);

// GET /api/opportunities/bookmarks — must come BEFORE /:id to prevent route shadowing
// Student only
router.get(
  '/bookmarks',
  requireRole('student'),
  validate(pageQuery),
  opportunityController.listBookmarks
);

// GET /api/opportunities — all authenticated roles (scoped by role in service)
router.get(
  '/',
  validate({ query: listOpportunitiesQuerySchema }),
  opportunityController.listOpportunities
);

// GET /api/opportunities/:id — all roles
router.get(
  '/:id',
  validate(uuidParam),
  opportunityController.getOpportunity
);

// POST /api/opportunities — admin and faculty
router.post(
  '/',
  requireRole('admin', 'faculty'),
  validate({ body: createOpportunitySchema }),
  opportunityController.createOpportunity
);

// PUT /api/opportunities/:id — admin and faculty (ownership enforced in service)
router.put(
  '/:id',
  requireRole('admin', 'faculty'),
  validate({ params: uuidParam.params, body: updateOpportunitySchema }),
  opportunityController.updateOpportunity
);

// DELETE /api/opportunities/:id — admin only
router.delete(
  '/:id',
  requireRole('admin'),
  validate(uuidParam),
  opportunityController.deleteOpportunity
);

// POST /api/opportunities/:id/bookmark — student only
router.post(
  '/:id/bookmark',
  requireRole('student'),
  validate(uuidParam),
  opportunityController.toggleBookmark
);

export default router;
