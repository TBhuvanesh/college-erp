import { Router } from 'express';
import { z } from 'zod';
import * as submissionController from '../controllers/lmsSubmission.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { uploadLmsFile } from '../middleware/uploadLms';
import {
  submitAssignmentSchema,
  gradeSubmissionSchema,
  listSubmissionsQuerySchema,
} from '../types/lms';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid submission ID') }) };

router.use(authenticate);

// GET /api/lms/submissions — all roles (scoped by role in service)
router.get(
  '/',
  validate({ query: listSubmissionsQuerySchema }),
  submissionController.listSubmissions
);

// GET /api/lms/submissions/:id/download — admin and faculty (sub-route before /:id)
router.get(
  '/:id/download',
  validate(uuidParam),
  submissionController.downloadSubmission
);

// GET /api/lms/submissions/:id — all roles
router.get(
  '/:id',
  validate(uuidParam),
  submissionController.getSubmission
);

// POST /api/lms/submissions — student only; handles initial submit + resubmission
router.post(
  '/',
  requireRole('student'),
  uploadLmsFile,
  validate({ body: submitAssignmentSchema }),
  submissionController.submitAssignment
);

// PUT /api/lms/submissions/:id — faculty only (grading)
router.put(
  '/:id',
  requireRole('faculty'),
  validate({ params: uuidParam.params, body: gradeSubmissionSchema }),
  submissionController.gradeSubmission
);

export default router;
