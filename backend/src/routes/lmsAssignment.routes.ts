import { Router } from 'express';
import { z } from 'zod';
import * as assignmentController from '../controllers/lmsAssignment.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  listAssignmentsQuerySchema,
} from '../types/lms';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid assignment ID') }) };

router.use(authenticate);

// GET /api/lms/assignments — all roles (scoped by role in service)
router.get(
  '/',
  validate({ query: listAssignmentsQuerySchema }),
  assignmentController.listAssignments
);

// GET /api/lms/assignments/:id — all roles
router.get(
  '/:id',
  validate(uuidParam),
  assignmentController.getAssignment
);

// POST /api/lms/assignments — faculty only
router.post(
  '/',
  requireRole('faculty'),
  validate({ body: createAssignmentSchema }),
  assignmentController.createAssignment
);

// PUT /api/lms/assignments/:id — faculty only
router.put(
  '/:id',
  requireRole('faculty'),
  validate({ params: uuidParam.params, body: updateAssignmentSchema }),
  assignmentController.updateAssignment
);

// DELETE /api/lms/assignments/:id — faculty only
router.delete(
  '/:id',
  requireRole('faculty'),
  validate(uuidParam),
  assignmentController.deleteAssignment
);

export default router;
