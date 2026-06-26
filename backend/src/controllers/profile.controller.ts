import type { Request, Response } from 'express';
import * as profileService from '../services/profile.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { UpdateProfileInput, ChangePasswordInput } from '../types/profile';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await profileService.getProfile(req.user!.id, req.user!.role);
  sendSuccess(res, { profile });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateProfileInput;
  const profile = await profileService.updateProfile(
    req.user!.id,
    req.user!.role,
    data,
    req.user!.id
  );
  sendSuccess(res, { profile }, 'Profile updated successfully');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as ChangePasswordInput;
  await profileService.changePassword(req.user!.id, data);
  sendSuccess(res, null, 'Password changed successfully. Please log in again.');
});
