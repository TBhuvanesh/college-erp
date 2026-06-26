import rateLimit from 'express-rate-limit';
import { AppError } from '../errors/AppError';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests, please try again later', 429, 'RATE_LIMIT_EXCEEDED'));
  },
});

// Stricter limiter scoped to authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many authentication attempts', 429, 'AUTH_RATE_LIMITED'));
  },
});
