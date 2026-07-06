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
  facultyId?: string;
  facultyProfile?: {
    id: string;
    employeeNumber: string;
    fullName: string;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    designation: string;
  };
}

interface UserRow {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  faculty_id?: string;
  employee_number?: string;
  full_name?: string;
  designation?: string;
  department_id?: string;
  department_name?: string;
  department_code?: string;
}

/**
 * Fetches the live profile for an authenticated user.
 * Used by GET /api/auth/me so the response always reflects the current DB state,
 * not stale JWT claims.
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  const { rows } = await query<UserRow>(
    `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at,
            f.id AS faculty_id, f.employee_number, f.full_name,
            f.designation, f.department_id,
            d.name AS department_name, d.code AS department_code
     FROM users u
     LEFT JOIN faculty f ON f.user_id = u.id AND f.deleted_at IS NULL
     LEFT JOIN departments d ON d.id = f.department_id
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
    facultyId: r.faculty_id || undefined,
    facultyProfile: r.faculty_id ? {
      id: r.faculty_id,
      employeeNumber: r.employee_number!,
      fullName: r.full_name!,
      departmentId: r.department_id!,
      departmentName: r.department_name!,
      departmentCode: r.department_code!,
      designation: r.designation!,
    } : undefined,
  };
}
