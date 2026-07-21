import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../errors/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  let token = '';
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    next(AppError.unauthorized('No access token provided'));
    return;
  }

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