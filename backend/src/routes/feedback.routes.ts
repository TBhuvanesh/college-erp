import { Router } from 'express';
import * as feedbackController from '../controllers/feedback.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// ── Campaigns (Admin manages; declared before /:id so literals aren't swallowed) ──
router.post('/campaigns/preview-eligibility', requireRole('admin'), feedbackController.previewEligibility);
router.get('/campaigns', requireRole('admin', 'faculty'), feedbackController.listCampaigns);
router.post('/campaigns', requireRole('admin'), feedbackController.createCampaign);
router.get('/campaigns/:id', requireRole('admin', 'faculty'), feedbackController.getCampaign);
router.put('/campaigns/:id', requireRole('admin'), feedbackController.updateCampaign);
router.post('/campaigns/:id/publish', requireRole('admin'), feedbackController.publishCampaign);
router.post('/campaigns/:id/close', requireRole('admin'), feedbackController.closeCampaign);
router.post('/campaigns/:id/archive', requireRole('admin'), feedbackController.archiveCampaign);

// ── Student-facing ──────────────────────────────────────────────────────────────
router.get('/my-campaigns', requireRole('student'), feedbackController.getMyCampaigns);
router.post('/submit', requireRole('student'), feedbackController.submitFeedback);
router.get('/my-submissions', requireRole('student'), feedbackController.getMySubmissions);

// ── Legacy paths — kept working (additive), now eligibility-driven under the hood ──
router.get('/active-windows', feedbackController.getActiveWindows);
router.get('/windows', requireRole('admin', 'faculty'), feedbackController.listCampaigns);
router.post('/windows', requireRole('admin'), feedbackController.createCampaign);

// ── Analytics (Admin, Faculty, HOD) ──────────────────────────────────────────────
router.get('/analytics', requireRole('admin', 'faculty'), feedbackController.getAnalytics);

// ── Templates ─────────────────────────────────────────────────────────────────
router.get('/templates', feedbackController.getTemplates);
router.post('/templates', requireRole('admin'), feedbackController.createTemplate);
router.put('/templates/:id', requireRole('admin'), feedbackController.updateTemplate);

// ── Questions ─────────────────────────────────────────────────────────────────
router.post('/questions', requireRole('admin'), feedbackController.createQuestion);
router.put('/questions/:id', requireRole('admin'), feedbackController.updateQuestion);
router.delete('/questions/:id', requireRole('admin'), feedbackController.deleteQuestion);

export default router;
