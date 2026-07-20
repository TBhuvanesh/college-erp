import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../errors/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(AppError.unauthorized('No access token provided'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isActive: true,
      designation: payload.designation,
      departmentId: payload.departmentId,
      facultyId: payload.facultyId,
      studentId: payload.studentId,
      isSuperAdmin: payload.isSuperAdmin,
    };
    next();
  } catch (err) {
    next(err);
  }
}