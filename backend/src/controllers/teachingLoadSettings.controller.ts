import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../errors/AppError';
import * as settingsService from '../services/teachingLoadSettings.service';
import { updateTeachingLoadSettingsSchema } from '../types/teachingLoadSettings';

// ── GET /api/teaching-load-settings ──────────────────────────────────────────
// Readable by admin/HOD/faculty (workload calculations and warnings on the
// Faculty Dashboard and Teaching Assignment pages need these values too).
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getTeachingLoadSettings();
  sendSuccess(res, { settings });
});

// ── PUT /api/teaching-load-settings (Admin only) ─────────────────────────────
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'admin') {
    throw AppError.forbidden('Only administrative roles can update teaching load settings', 'ADMIN_ONLY');
  }
  const input = updateTeachingLoadSettingsSchema.parse(req.body);
  const settings = await settingsService.updateTeachingLoadSettings(input, user.id);
  sendSuccess(res, { settings }, 'Teaching load settings updated successfully');
});
