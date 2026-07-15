import { Router } from 'express';
import * as experienceController from '../controllers/experience.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { dashboardWidgetsQuerySchema } from '../types/experience';

const router = Router();

router.use(authenticate);

// Student Experience — own timeline only (enforced in the service layer via
// the authenticated user's own student profile, never a passed-in ID).
router.get('/student', requireRole('student'), experienceController.getStudentExperience);
router.get('/student/timeline', requireRole('student'), experienceController.getStudentTimeline);
router.get('/student/actions', requireRole('student'), experienceController.getStudentActions);
router.get('/student/week', requireRole('student'), experienceController.getStudentWeek);

// Faculty Experience — own timeline (HOD gets department-level widgets via
// the same endpoint, resolved from designation in the service layer).
router.get('/faculty', requireRole('faculty'), experienceController.getFacultyExperience);
router.get('/faculty/timeline', requireRole('faculty'), experienceController.getFacultyTimeline);
router.get('/faculty/actions', requireRole('faculty'), experienceController.getFacultyActions);

// Smart Dashboard widgets — student (own), faculty/HOD (own/department), admin (institution).
router.get(
  '/dashboard/widgets',
  requireRole('admin', 'faculty', 'student'),
  validate({ query: dashboardWidgetsQuerySchema }),
  experienceController.getDashboardWidgets
);

export default router;
