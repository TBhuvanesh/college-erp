import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { adminAnalyticsQuerySchema } from '../types/analytics';

const router = Router();

router.use(authenticate);

// GET /api/analytics/admin — institution-wide (admin only)
router.get(
  '/admin',
  requireRole('admin'),
  validate({ query: adminAnalyticsQuerySchema }),
  analyticsController.getAdminAnalytics
);

// GET /api/analytics/hod — department-only (faculty w/ designation='hod', enforced in service)
router.get('/hod', requireRole('faculty'), analyticsController.getHodAnalytics);

// GET /api/analytics/faculty — assigned subjects/students/mentorship/teaching progress
router.get('/faculty', requireRole('faculty'), analyticsController.getFacultyAnalytics);

// GET /api/analytics/student — own data only
router.get('/student', requireRole('student'), analyticsController.getStudentAnalytics);

export default router;
