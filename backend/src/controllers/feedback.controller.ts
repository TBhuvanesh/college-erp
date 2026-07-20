import { Request, Response, NextFunction } from 'express';
import * as feedbackService from '../services/feedback.service';
import {
  createCampaignSchema,
  updateCampaignSchema,
  previewEligibilitySchema,
  listCampaignsQuerySchema,
  submitFeedbackSchema,
  createTemplateSchema,
  updateTemplateSchema,
  createQuestionSchema,
  updateQuestionSchema,
} from '../types/feedback';
import { AppError } from '../errors/AppError';

// ── Campaigns ─────────────────────────────────────────────────────────────────

export const createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createCampaignSchema.parse(req.body);
    const campaign = await feedbackService.createCampaign(data, req.user!.id);
    res.status(201).json({ success: true, data: campaign, message: 'Feedback campaign created as draft' });
  } catch (err) {
    next(err);
  }
};

export const updateCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateCampaignSchema.parse(req.body);
    const campaign = await feedbackService.updateCampaign(req.params.id, data, req.user!.id);
    res.json({ success: true, data: campaign, message: 'Feedback campaign updated' });
  } catch (err) {
    next(err);
  }
};

export const listCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = listCampaignsQuerySchema.parse(req.query);
    const campaigns = await feedbackService.getCampaigns(filters);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
};

export const getCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await feedbackService.getCampaignById(req.params.id);
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

export const previewEligibility = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = previewEligibilitySchema.parse(req.body);
    const result = await feedbackService.previewEligibility(data);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const publishCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await feedbackService.publishCampaign(req.params.id, req.user!.id);
    res.json({ success: true, data: campaign, message: 'Campaign published — eligible students have been notified' });
  } catch (err) {
    next(err);
  }
};

export const closeCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await feedbackService.closeCampaign(req.params.id, req.user!.id);
    res.json({ success: true, data: campaign, message: 'Campaign closed' });
  } catch (err) {
    next(err);
  }
};

export const archiveCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await feedbackService.archiveCampaign(req.params.id, req.user!.id);
    res.json({ success: true, data: campaign, message: 'Campaign archived' });
  } catch (err) {
    next(err);
  }
};

// ── Student-facing ────────────────────────────────────────────────────────────

export const getMyCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaigns = await feedbackService.getEligibleCampaignsForStudent(req.user!.id);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
};

/** Legacy `/feedback/active-windows` path, kept working: students get their
 * eligibility-scoped campaign list, everyone else gets currently-published campaigns. */
export const getActiveWindows = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === 'student') {
      const campaigns = await feedbackService.getEligibleCampaignsForStudent(req.user.id);
      res.json({ success: true, data: campaigns });
      return;
    }
    const campaigns = await feedbackService.getCampaigns({ status: 'published' });
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
};

export const submitFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = submitFeedbackSchema.parse(req.body);
    await feedbackService.submitFeedback(req.user!.id, data);
    res.json({ success: true, message: 'Feedback submitted anonymously.' });
  } catch (err) {
    next(err);
  }
};

export const getMySubmissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) throw AppError.badRequest('campaignId is required');
    const submissions = await feedbackService.getStudentSubmissions(req.user!.id, campaignId);
    res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) throw AppError.badRequest('campaignId is required');

    const filterOptions: { departmentId?: string; facultyId?: string; subjectId?: string } = {};

    if (req.user?.role === 'faculty') {
      if ((req.user as any).designation === 'hod') {
        filterOptions.departmentId = (req.user as any).departmentId;
        if (req.query.facultyId) filterOptions.facultyId = req.query.facultyId as string;
        if (req.query.subjectId) filterOptions.subjectId = req.query.subjectId as string;
      } else {
        filterOptions.facultyId = req.user.id;
      }
    }

    if (req.user?.role === 'admin') {
      if (req.query.departmentId) filterOptions.departmentId = req.query.departmentId as string;
      if (req.query.facultyId) filterOptions.facultyId = req.query.facultyId as string;
      if (req.query.subjectId) filterOptions.subjectId = req.query.subjectId as string;
    }

    const analytics = await feedbackService.getCampaignAnalytics(campaignId, filterOptions);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
};

// ── Templates ─────────────────────────────────────────────────────────────────

export const getTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const type = req.query.type as string | undefined;
    const templates = await feedbackService.getTemplates(type);
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
};

export const createTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createTemplateSchema.parse(req.body);
    const template = await feedbackService.createTemplate(data, req.user!.id);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateTemplateSchema.parse(req.body);
    const template = await feedbackService.updateTemplate(req.params.id, data, req.user!.id);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

// ── Questions ─────────────────────────────────────────────────────────────────

export const createQuestion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createQuestionSchema.parse(req.body);
    const question = await feedbackService.createQuestion(data, req.user!.id);
    res.status(201).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateQuestionSchema.parse(req.body);
    const question = await feedbackService.updateQuestion(req.params.id, data, req.user!.id);
    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await feedbackService.deleteQuestion(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (err) {
    next(err);
  }
};
