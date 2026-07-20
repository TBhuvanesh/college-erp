import type { Request, Response } from 'express';
import * as mentorshipSettingsService from '../services/mentorshipSettings.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { UpdateMentorshipSettingsInput } from '../types/mentorGroup';

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await mentorshipSettingsService.getMentorshipSettings();
  sendSuccess(res, { settings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateMentorshipSettingsInput;
  const settings = await mentorshipSettingsService.updateMentorshipSettings(req.user!.id, data);
  sendSuccess(res, { settings }, 'Mentorship settings updated successfully');
});
