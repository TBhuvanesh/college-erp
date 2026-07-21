import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
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

// Setup memory storage multer for Excel/CSV imports
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Secure all subject catalog routes with authentication
router.use(authenticate);

// ── Read/Export operations (Admin and Faculty/HOD only) ────────────────────────
router.get(
  '/',
  requireRole('admin', 'faculty'),
  validate({ query: listSubjectsQuerySchema }),
  subjectController.listSubjects
);

router.get(
  '/export',
  requireRole('admin', 'faculty'),
  subjectController.exportSubjects
);

router.get(
  '/:id',
  requireRole('admin', 'faculty'),
  validate(uuidParam),
  subjectController.getSubject
);

// ── Write operations (Admin only) ──────────────────────────────────────────────
router.post(
  '/',
  requireRole('admin'),
  validate({ body: createSubjectSchema }),
  subjectController.createSubject
);

router.put(
  '/:id',
  requireRole('admin'),
  validate({ ...uuidParam, body: updateSubjectSchema }),
  subjectController.updateSubject
);

router.patch(
  '/:id/status',
  requireRole('admin'),
  validate({ ...uuidParam, body: updateSubjectStatusSchema }),
  subjectController.updateSubjectStatus
);

router.delete(
  '/all/wipe',
  requireRole('admin'),
  subjectController.deleteAllSubjects
);

router.delete(
  '/:id',
  requireRole('admin'),
  validate(uuidParam),
  subjectController.deleteSubject
);

// ── Spreadsheet bulk operations (Admin only) ───────────────────────────────────
router.post(
  '/import/preview',
  requireRole('admin'),
  upload.single('file'),
  subjectController.importPreview
);

router.post(
  '/import',
  requireRole('admin'),
  subjectController.importCommit
);

export default router;
