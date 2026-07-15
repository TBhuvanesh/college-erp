import { Router } from 'express';
import { z } from 'zod';
import * as teachingPlanController from '../controllers/teachingPlan.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createTeachingPlanSchema,
  updateTeachingPlanSchema,
  updateLessonStatusSchema,
  rescheduleTeachingPlanSchema,
  continueLessonSchema,
  listTeachingPlansQuerySchema,
  courseProgressQuerySchema,
  studentScopedQuerySchema,
  upcomingQuerySchema,
} from '../types/teachingPlan';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid teaching plan ID') }) };

router.use(authenticate);

// ── Static read routes — must be registered before GET /:id ─────────────────────

// GET /api/teaching-plans/student-roadmap — student (own) / admin (via studentId)
router.get(
  '/student-roadmap',
  validate({ query: studentScopedQuerySchema }),
  teachingPlanController.getStudentRoadmap
);

// GET /api/teaching-plans/today — all roles (scoped by role in service)
router.get('/today', validate({ query: studentScopedQuerySchema }), teachingPlanController.getTodayLessons);

// GET /api/teaching-plans/upcoming?view=week|month|semester — all roles
router.get('/upcoming', validate({ query: upcomingQuerySchema }), teachingPlanController.getUpcomingLessons);

// GET /api/teaching-plans/progress — all roles (scoped by role in service)
router.get('/progress', validate({ query: courseProgressQuerySchema }), teachingPlanController.getCourseProgress);

// GET /api/teaching-plans — all roles (scoped by role in service)
router.get('/', validate({ query: listTeachingPlansQuerySchema }), teachingPlanController.listTeachingPlans);

// GET /api/teaching-plans/:id — all roles
router.get('/:id', validate(uuidParam), teachingPlanController.getTeachingPlan);

// POST /api/teaching-plans — faculty only
router.post(
  '/',
  requireRole('faculty'),
  validate({ body: createTeachingPlanSchema }),
  teachingPlanController.createTeachingPlan
);

// PUT /api/teaching-plans/:id — faculty only (generic content edit)
router.put(
  '/:id',
  requireRole('faculty'),
  validate({ params: uuidParam.params, body: updateTeachingPlanSchema }),
  teachingPlanController.updateTeachingPlan
);

// DELETE /api/teaching-plans/:id — faculty only
router.delete('/:id', requireRole('faculty'), validate(uuidParam), teachingPlanController.deleteTeachingPlan);

// PUT /api/teaching-plans/:id/status — faculty only — Lesson Progress Engine
router.put(
  '/:id/status',
  requireRole('faculty'),
  validate({ params: uuidParam.params, body: updateLessonStatusSchema }),
  teachingPlanController.updateLessonStatus
);

// PUT /api/teaching-plans/:id/reschedule — faculty only
router.put(
  '/:id/reschedule',
  requireRole('faculty'),
  validate({ params: uuidParam.params, body: rescheduleTeachingPlanSchema }),
  teachingPlanController.rescheduleTeachingPlan
);

// PUT /api/teaching-plans/:id/continue — faculty only — Auto Shift Engine
router.put(
  '/:id/continue',
  requireRole('faculty'),
  validate({ params: uuidParam.params, body: continueLessonSchema }),
  teachingPlanController.continueLesson
);

export default router;
