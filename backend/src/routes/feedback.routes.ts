import { Router } from 'express';
import * as feedbackController from '../controllers/feedback.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

// Retrieve active feedback windows (Open to everyone authenticated)
router.get(
  '/active-windows',
  authenticate,
  feedbackController.getActiveWindows
);

// Retrieve all feedback windows (Open to everyone authenticated)
router.get(
  '/windows',
  authenticate,
  feedbackController.getWindows
);

// Retrieve templates/questions (Open to everyone authenticated)
router.get(
  '/templates',
  authenticate,
  feedbackController.getTemplates
);

// Submit feedback (Strictly students)
router.post(
  '/submit',
  authenticate,
  requireRole('student'),
  feedbackController.submitFeedback
);

// Get student submission logs
router.get(
  '/my-submissions',
  authenticate,
  requireRole('student'),
  feedbackController.getMySubmissions
);

// View analytics (Admin, Faculty, HOD)
router.get(
  '/analytics',
  authenticate,
  requireRole('admin', 'faculty'),
  feedbackController.getAnalytics
);

export default router;
