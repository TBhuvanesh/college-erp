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
  studentId?: string;
  studentProfile?: {
    id: string;
    rollNumber: string;
    fullName: string;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    semester: number;
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
  faculty_full_name?: string;
  designation?: string;
  faculty_dept_id?: string;
  faculty_dept_name?: string;
  faculty_dept_code?: string;
  student_id?: string;
  roll_number?: string;
  student_full_name?: string;
  student_dept_id?: string;
  student_dept_name?: string;
  student_dept_code?: string;
  semester?: number;
}

/**
 * Fetches the live profile for an authenticated user.
 * Used by GET /api/auth/me so the response always reflects the current DB state,
 * not stale JWT claims.
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  const { rows } = await query<UserRow>(
    `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at,
            f.id AS faculty_id, f.employee_number, f.full_name AS faculty_full_name,
            f.designation, f.department_id AS faculty_dept_id,
            fd.name AS faculty_dept_name, fd.code AS faculty_dept_code,
            s.id AS student_id, s.roll_number, s.full_name AS student_full_name,
            s.department_id AS student_dept_id, s.semester,
            sd.name AS student_dept_name, sd.code AS student_dept_code
     FROM users u
     LEFT JOIN faculty f ON f.user_id = u.id AND f.deleted_at IS NULL
     LEFT JOIN departments fd ON fd.id = f.department_id
     LEFT JOIN students s ON s.user_id = u.id AND s.deleted_at IS NULL
     LEFT JOIN departments sd ON sd.id = s.department_id
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
    departmentId: r.faculty_dept_id || r.student_dept_id || undefined,
    facultyId: r.faculty_id || undefined,
    facultyProfile: r.faculty_id ? {
      id: r.faculty_id,
      employeeNumber: r.employee_number!,
      fullName: r.faculty_full_name!,
      departmentId: r.faculty_dept_id!,
      departmentName: r.faculty_dept_name!,
      departmentCode: r.faculty_dept_code!,
      designation: r.designation!,
    } : undefined,
    studentId: r.student_id || undefined,
    studentProfile: r.student_id ? {
      id: r.student_id,
      rollNumber: r.roll_number!,
      fullName: r.student_full_name!,
      departmentId: r.student_dept_id!,
      departmentName: r.student_dept_name!,
      departmentCode: r.student_dept_code!,
      semester: Number(r.semester!),
    } : undefined,
  };
}
