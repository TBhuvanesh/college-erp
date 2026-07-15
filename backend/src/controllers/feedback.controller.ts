import { Request, Response } from 'express';
import { feedbackService } from '../services/feedback.service';

export const getActiveWindows = async (_req: Request, res: Response): Promise<void> => {
  const windows = await feedbackService.getActiveWindows();
  res.json({ success: true, data: windows });
};

export const getWindows = async (_req: Request, res: Response): Promise<void> => {
  const windows = await feedbackService.getWindows();
  res.json({ success: true, data: windows });
};


export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type as string;
  const templates = await feedbackService.getTemplates(type);
  res.json({ success: true, data: templates });
};

export const submitFeedback = async (req: Request, res: Response): Promise<void> => {
  // Enforce student role
  if (req.user?.role !== 'student') {
    res.status(403).json({ success: false, message: 'Only students can submit feedback.' });
    return;
  }

  await feedbackService.submitFeedback(req.user!.id, req.body);
  res.json({ success: true, message: 'Feedback submitted anonymously.' });
};

export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  const windowId = req.query.windowId as string;
  if (!windowId) {
    res.status(400).json({ success: false, message: 'windowId is required' });
    return;
  }

  let filterOptions: any = {};
  
  if (req.user?.role === 'faculty') {
    // HODs see all faculty in their department, regular faculty only see themselves
    if ((req.user as any).designation === 'hod') {
      filterOptions.departmentId = (req.user as any).departmentId;
      if (req.query.facultyId) filterOptions.facultyId = req.query.facultyId;
      if (req.query.subjectId) filterOptions.subjectId = req.query.subjectId;
    } else {
      filterOptions.facultyId = req.user.id;
    }
  }

  // Admin sees everything unless they explicitly filter
  if (req.user?.role === 'admin') {
    if (req.query.departmentId) filterOptions.departmentId = req.query.departmentId;
    if (req.query.facultyId) filterOptions.facultyId = req.query.facultyId;
    if (req.query.subjectId) filterOptions.subjectId = req.query.subjectId;
  }

  const analytics = await feedbackService.getAnalytics(windowId, filterOptions);
  res.json({ success: true, data: analytics });
};

export const getMySubmissions = async (req: Request, res: Response): Promise<void> => {
  if (req.user?.role !== 'student') {
    res.status(403).json({ success: false, message: 'Only students can check submission status.' });
    return;
  }
  const windowId = req.query.windowId as string;
  if (!windowId) {
    res.status(400).json({ success: false, message: 'windowId is required' });
    return;
  }
  const submissions = await feedbackService.getStudentSubmissions(req.user!.id, windowId);
  res.json({ success: true, data: submissions });
};

