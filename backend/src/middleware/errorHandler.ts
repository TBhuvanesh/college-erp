import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Map PostgreSQL errors to operational AppError instances
  if (err && typeof err === 'object' && 'code' in err) {
    const pgErr = err as { code: string; message: string };
    
    // 23505: Unique violation (Conflict)
    if (pgErr.code === '23505') {
      const appErr = AppError.conflict('A record with this value already exists', 'DUPLICATE_RECORD');
      res.status(appErr.statusCode).json({
        success: false,
        code: appErr.code,
        message: appErr.message,
      });
      return;
    }

    // 23503: Foreign key violation (Bad Request)
    if (pgErr.code === '23503') {
      const appErr = AppError.badRequest('Referenced record does not exist or is in use', 'FOREIGN_KEY_VIOLATION');
      res.status(appErr.statusCode).json({
        success: false,
        code: appErr.code,
        message: appErr.message,
      });
      return;
    }

    // 23502: Not null violation (Bad Request)
    if (pgErr.code === '23502') {
      const appErr = AppError.badRequest('Required field is missing', 'NOT_NULL_VIOLATION');
      res.status(appErr.statusCode).json({
        success: false,
        code: appErr.code,
        message: appErr.message,
      });
      return;
    }
  }

  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
    return;
  }

  console.error('[Unhandled Error]', err);

  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message:
      env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
  });
}
