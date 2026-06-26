import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

const REFRESH_COOKIE = 'erp_refresh_token';

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const { tokens, user } = await authService.login(email, password);

  await auditLog({ actorId: user.id, action: 'LOGIN', resource: 'users', resourceId: user.id, req });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);

  sendSuccess(res, {
    accessToken: tokens.accessToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];

  if (!refreshToken) {
    throw AppError.unauthorized('No refresh token provided');
  }

  const { tokens, user } = await authService.refresh(refreshToken);

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);

  sendSuccess(res, {
    accessToken: tokens.accessToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  sendSuccess(res, null, 'Logged out successfully');
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  await authService.logoutAll(userId);
  await auditLog({ actorId: userId, action: 'LOGOUT_ALL', resource: 'users', resourceId: userId, req });

  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  sendSuccess(res, null, 'All sessions terminated');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  // Fetch from DB so the response reflects live state (role changes, deactivation)
  // rather than potentially stale JWT claims.
  const profile = await userService.getProfile(req.user!.id);
  sendSuccess(res, { user: profile });
});
