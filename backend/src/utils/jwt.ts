import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtAccessPayload, JwtRefreshPayload } from '../types/auth';
import { AppError } from '../errors/AppError';

export function signAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
  } catch {
    throw AppError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID');
  }
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token', 'TOKEN_INVALID');
  }
}
