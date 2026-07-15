import type { Request, Response, NextFunction } from 'express';
import { PERMISSIONS } from '../types/roles';
import type { Permission, Role } from '../types/roles';
import { AppError } from '../errors/AppError';

/**
 * Checks that the authenticated user's role is listed in every requested permission.
 * Use this for resource-action checks: authorize('attendance:create').
 */
export function authorize(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    const { role } = req.user;

    const missing = permissions.find(
      (p) => !(PERMISSIONS[p] as readonly string[]).includes(role)
    );

    if (missing) {
      next(
        AppError.forbidden(
          `Role '${role}' lacks permission '${missing}'`,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
      return;
    }

    next();
  };
}

/**
 * Restricts access to an explicit allowlist of roles.
 * Use this for coarse-grained role checks: requireRole('admin').
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        AppError.forbidden(
          `Access restricted to: ${roles.join(', ')}`,
          'ROLE_FORBIDDEN'
        )
      );
      return;
    }

    next();
  };
}

/**
 * Restricts access to admin users additionally flagged as super admin
 * (users.is_super_admin) — a capability flag, not a distinct Role, mirroring
 * how HOD is a `designation` on faculty rather than its own role.
 * Use for workflow-configuration endpoints only.
 */
export function requireSuperAdmin() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (req.user.role !== 'admin' || !req.user.isSuperAdmin) {
      next(AppError.forbidden('Access restricted to super admins', 'SUPER_ADMIN_REQUIRED'));
      return;
    }

    next();
  };
}
