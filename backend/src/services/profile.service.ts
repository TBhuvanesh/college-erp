import { query } from '../config/database';
import { verifyPassword, hashPassword } from '../utils/password';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  ProfileView,
  AdminProfile,
  FacultyProfile,
  StudentProfile,
  UpdateProfileInput,
  ChangePasswordInput,
} from '../types/profile';
import type { Role } from '../types/roles';

// ── Row types (snake_case from PostgreSQL) ────────────────────────────────────

interface UserBaseRow {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: Role;
  is_active: boolean;
  created_at: Date;
  last_login: Date | null;
}

interface FacultyRow extends UserBaseRow {
  employee_number: string;
  designation: string;
  department_id: string;
  department_name: string;
  department_code: string;
}

interface StudentRow extends UserBaseRow {
  id: string;
  roll_number: string;
  semester: number;
  section: string | null;
  academic_year: string;
  status: string;
  department_id: string;
  department_name: string;
  department_code: string;
  program_id: string;
  program_name: string;
  program_code: string;
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getProfile(userId: string, role: Role): Promise<ProfileView> {
  if (role === 'admin') return fetchAdminProfile(userId);
  if (role === 'faculty') return fetchFacultyProfile(userId);
  return fetchStudentProfile(userId);
}

async function fetchAdminProfile(userId: string): Promise<AdminProfile> {
  const { rows } = await query<UserBaseRow>(
    `SELECT
       u.id         AS user_id,
       u.full_name,
       u.email,
       u.phone_number,
       u.role,
       u.is_active,
       u.created_at,
       u.last_login
     FROM users u
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Profile not found');
  const r = rows[0];
  return {
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    phoneNumber: r.phone_number,
    role: 'admin',
    isActive: r.is_active,
    createdAt: r.created_at,
    lastLogin: r.last_login,
  };
}

async function fetchFacultyProfile(userId: string): Promise<FacultyProfile> {
  const { rows } = await query<FacultyRow>(
    `SELECT
       u.id         AS user_id,
       u.full_name,
       u.email,
       u.phone_number,
       u.role,
       u.is_active,
       u.created_at,
       u.last_login,
       f.employee_number,
       f.designation,
       d.id   AS department_id,
       d.name AS department_name,
       d.code AS department_code
     FROM users u
     JOIN faculty     f ON f.user_id = u.id AND f.deleted_at IS NULL
     JOIN departments d ON d.id = f.department_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Faculty profile not found');
  const r = rows[0];
  return {
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    phoneNumber: r.phone_number,
    role: 'faculty',
    isActive: r.is_active,
    createdAt: r.created_at,
    lastLogin: r.last_login,
    employeeNumber: r.employee_number,
    designation: r.designation,
    department: {
      id: r.department_id,
      name: r.department_name,
      code: r.department_code,
    },
  };
}

async function fetchStudentProfile(userId: string): Promise<StudentProfile> {
  const { rows } = await query<StudentRow>(
    `SELECT
       u.id         AS user_id,
       u.full_name,
       u.email,
       u.phone_number,
       u.role,
       u.is_active,
       u.created_at,
       u.last_login,
       s.id         AS id,
       s.roll_number,
       s.semester,
       s.section,
       s.academic_year,
       s.status,
       d.id   AS department_id,
       d.name AS department_name,
       d.code AS department_code,
       p.id   AS program_id,
       p.name AS program_name,
       p.code AS program_code
     FROM users u
     JOIN students    s ON s.user_id = u.id AND s.deleted_at IS NULL
     JOIN departments d ON d.id = s.department_id
     JOIN programs    p ON p.id = s.program_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  const r = rows[0];
  return {
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    phoneNumber: r.phone_number,
    role: 'student',
    isActive: r.is_active,
    createdAt: r.created_at,
    lastLogin: r.last_login,
    id: r.id,
    rollNumber: r.roll_number,
    semester: r.semester,
    year: Math.ceil(r.semester / 2),
    section: r.section,
    academicYear: r.academic_year,
    status: r.status,
    department: {
      id: r.department_id,
      name: r.department_name,
      code: r.department_code,
    },
    program: {
      id: r.program_id,
      name: r.program_name,
      code: r.program_code,
    },
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  role: Role,
  data: UpdateProfileInput,
  actorId: string
): Promise<ProfileView> {
  if (data.email) {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL`,
      [data.email, userId]
    );
    if (rows[0]) throw AppError.conflict('Email address is already in use', 'EMAIL_TAKEN');
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (data.email !== undefined) set('email', data.email);
  if (data.phoneNumber !== undefined) set('phone_number', data.phoneNumber);

  params.push(userId);
  const { rowCount } = await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL`,
    params
  );
  if (!rowCount) throw AppError.notFound('User not found');

  await auditLog({
    actorId,
    action: 'UPDATE_PROFILE',
    resource: 'users',
    resourceId: userId,
    changes: data as Record<string, unknown>,
  });

  return getProfile(userId, role);
}

export async function changePassword(
  userId: string,
  data: ChangePasswordInput
): Promise<void> {
  const { rows } = await query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('User not found');

  const valid = await verifyPassword(data.currentPassword, rows[0].password_hash);
  if (!valid) {
    throw AppError.badRequest('Current password is incorrect', 'WRONG_PASSWORD');
  }

  const newHash = await hashPassword(data.newPassword);

  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);

  // Revoke all active refresh tokens — force re-login from all devices after password change
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  await auditLog({
    actorId: userId,
    action: 'CHANGE_PASSWORD',
    resource: 'users',
    resourceId: userId,
  });
}
