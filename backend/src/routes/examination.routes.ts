import { Router } from 'express';
import { z } from 'zod';
import * as examController from '../controllers/examination.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createExamSchema,
  updateExamSchema,
  updateExamStatusSchema,
  listExamsQuerySchema,
} from '../types/examination';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid examination ID') }) };

// ── Static segments must be declared before /:id ──────────────────────────────

// Faculty: view own schedule
router.get(
  '/my-schedule',
  authenticate,
  requireRole('faculty'),
  examController.getMySchedule
);

// Student: full timetable (non-cancelled exams for their semester+section)
router.get(
  '/timetable',
  authenticate,
  requireRole('student'),
  examController.getTimetable
);

// Student: upcoming exams only (Scheduled/Ongoing, exam_date >= today)
router.get(
  '/upcoming',
  authenticate,
  requireRole('student'),
  examController.getUpcomingExams
);

// ── Collection endpoints ──────────────────────────────────────────────────────

// Admin + Faculty: list with optional filters
router.get(
  '/',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ query: listExamsQuerySchema }),
  examController.listExams
);

// Admin + Faculty: schedule a new examination
router.post(
  '/',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ body: createExamSchema }),
  examController.createExam
);

// ── Individual exam endpoints (/:id must come last) ───────────────────────────

// Admin + Faculty + Student: view single exam
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty', 'student'),
  validate(uuidParam),
  examController.getExam
);

// Admin + Faculty: update details (date, time, marks, section)
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ ...uuidParam, body: updateExamSchema }),
  examController.updateExam
);

// Admin + Faculty: transition status
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ ...uuidParam, body: updateExamStatusSchema }),
  examController.updateExamStatus
);

// Admin only: soft-delete
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  examController.deleteExam
);

export default router;
