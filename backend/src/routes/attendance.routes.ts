import { Router } from 'express';
import { z } from 'zod';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  markAttendanceSchema,
  updateAttendanceSchema,
  listAttendanceQuerySchema,
  rosterQuerySchema,
  historyQuerySchema,
} from '../types/attendance';
import { createAssignmentSchema, listAssignmentsQuerySchema } from '../types/assignment';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid attendance record ID') }) };
const assignmentParam = {
  params: z.object({ assignmentId: z.string().uuid('Invalid assignment ID') }),
};

// ─────────────────────────────────────────────────────────────────────────────
// All static-segment routes MUST be declared before /:id to avoid Express
// treating path words like "sessions" or "roster" as UUID parameters.
// ─────────────────────────────────────────────────────────────────────────────

// ── Faculty Subject Assignment management (admin only) ────────────────────────
router.post(
  '/assignments',
  authenticate,
  requireRole('admin'),
  validate({ body: createAssignmentSchema }),
  attendanceController.createAssignment
);

router.get(
  '/assignments',
  authenticate,
  requireRole('admin'),
  validate({ query: listAssignmentsQuerySchema }),
  attendanceController.listAssignments
);

router.get(
  '/assignments/:assignmentId',
  authenticate,
  requireRole('admin'),
  validate(assignmentParam),
  attendanceController.getAssignment
);

router.delete(
  '/assignments/:assignmentId',
  authenticate,
  requireRole('admin'),
  validate(assignmentParam),
  attendanceController.deleteAssignment
);

// ── Faculty: view own subject assignments ─────────────────────────────────────
router.get(
  '/my-assignments',
  authenticate,
  requireRole('faculty'),
  attendanceController.getMyAssignments
);

// ── Faculty: get roster for a session ────────────────────────────────────────
router.get(
  '/roster',
  authenticate,
  requireRole('faculty'),
  validate({ query: rosterQuerySchema }),
  attendanceController.getRoster
);

// ── Faculty: mark / upsert attendance for a session ──────────────────────────
router.post(
  '/sessions',
  authenticate,
  requireRole('faculty'),
  validate({ body: markAttendanceSchema }),
  attendanceController.markAttendance
);

// ── Student: subject-wise summary + overall percentage ───────────────────────
router.get(
  '/summary',
  authenticate,
  requireRole('student'),
  attendanceController.getStudentSummary
);

// ── Student: attendance history (filterable by subject / date range) ──────────
router.get(
  '/history',
  authenticate,
  requireRole('student'),
  validate({ query: historyQuerySchema }),
  attendanceController.getStudentHistory
);

// ── Admin + faculty: paginated list with filters ──────────────────────────────
router.get(
  '/',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ query: listAttendanceQuerySchema }),
  attendanceController.listAttendance
);

// ── Admin + faculty: single record by ID ─────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate(uuidParam),
  attendanceController.getAttendance
);

// ── Admin + faculty: update a single record ───────────────────────────────────
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'faculty'),
  validate({ ...uuidParam, body: updateAttendanceSchema }),
  attendanceController.updateAttendance
);

export default router;
