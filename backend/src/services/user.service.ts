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
}

interface UserRow {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Fetches the live profile for an authenticated user.
 * Used by GET /api/auth/me so the response always reflects the current DB state,
 * not stale JWT claims.
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  const { rows } = await query<UserRow>(
    `SELECT id, email, role, is_active, created_at, updated_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
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
  };
}
