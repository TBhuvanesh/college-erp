import { query } from '../config/database';
import { AppError } from '../errors/AppError';
import type { Role } from '../types/roles';

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  designation?: string;
  departmentId?: string;
}

interface UserRow {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  designation?: string;
  department_id?: string;
}

/**
 * Fetches the live profile for an authenticated user.
 * Used by GET /api/auth/me so the response always reflects the current DB state,
 * not stale JWT claims.
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  const { rows } = await query<UserRow>(
    `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at,
            f.designation, f.department_id
     FROM users u
     LEFT JOIN faculty f ON f.user_id = u.id AND f.deleted_at IS NULL
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );

  if (!rows[0]) {
    // Should never happen for a valid JWT, but guards against soft-deleted accounts
    throw AppError.notFound('User profile not found');
  }

  const r = rows[0];
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    designation: r.designation || undefined,
    departmentId: r.department_id || undefined,
  };
}
