import { query, withTransaction } from '../config/database';
import { hashPassword } from '../utils/password';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  CreateFacultyInput,
  UpdateFacultyInput,
  UpdateFacultyStatusInput,
  ListFacultyQuery,
  FacultyDetail,
  FacultySummary,
  PaginatedFaculty,
} from '../types/faculty';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface FacultyDetailRow {
  id: string;
  user_id: string;
  employee_number: string;
  full_name: string;
  email: string;
  department_id: string;
  department_name: string;
  department_code: string;
  designation: FacultyDetail['designation'];
  status: FacultyDetail['status'];
  created_at: Date;
  updated_at: Date;
}

interface FacultyListRow extends FacultyDetailRow {
  total_count: string; // pg returns bigint as string
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const DETAIL_COLS = `
  f.id, f.user_id, f.employee_number, f.full_name,
  u.email,
  d.id   AS department_id,
  d.name AS department_name,
  d.code AS department_code,
  f.designation, f.status, f.created_at, f.updated_at
`;

const JOINS = `
  JOIN users       u ON u.id = f.user_id
  JOIN departments d ON d.id = f.department_id
`;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toDetail(r: FacultyDetailRow): FacultyDetail {
  return {
    id: r.id,
    userId: r.user_id,
    employeeNumber: r.employee_number,
    fullName: r.full_name,
    email: r.email,
    department: {
      id: r.department_id,
      name: r.department_name,
      code: r.department_code,
    },
    designation: r.designation,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSummary(r: FacultyDetailRow): FacultySummary {
  return {
    id: r.id,
    employeeNumber: r.employee_number,
    fullName: r.full_name,
    email: r.email,
    departmentName: r.department_name,
    designation: r.designation,
    status: r.status,
  };
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getFacultyById(id: string): Promise<FacultyDetail> {
  const { rows } = await query<FacultyDetailRow>(
    `SELECT ${DETAIL_COLS} FROM faculty f ${JOINS}
     WHERE f.id = $1 AND f.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Faculty member not found');
  return toDetail(rows[0]);
}

export async function getFacultyByUserId(userId: string): Promise<FacultyDetail> {
  const { rows } = await query<FacultyDetailRow>(
    `SELECT ${DETAIL_COLS} FROM faculty f ${JOINS}
     WHERE f.user_id = $1 AND f.deleted_at IS NULL`,
    [userId]
  );
  if (!rows[0]) throw AppError.notFound('Faculty profile not found');
  return toDetail(rows[0]);
}

export async function listFaculty(filters: ListFacultyQuery): Promise<PaginatedFaculty> {
  const conditions: string[] = ['f.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.departmentId) push('f.department_id =', filters.departmentId);
  if (filters.designation) push('f.designation =', filters.designation);
  if (filters.status) push('f.status =', filters.status);

  if (filters.search) {
    const term = `%${filters.search}%`;
    params.push(term);
    conditions.push(
      `(f.full_name ILIKE $${params.length} OR f.employee_number ILIKE $${params.length})`
    );
  }

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<FacultyListRow>(
    `SELECT ${DETAIL_COLS}, COUNT(*) OVER() AS total_count
     FROM faculty f ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY f.full_name ASC, f.employee_number ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    faculty: rows.map(toSummary),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function createFaculty(
  data: CreateFacultyInput,
  actorId: string
): Promise<FacultyDetail> {
  return withTransaction(async (client) => {
    // Validate department exists
    const { rows: dept } = await client.query<{ id: string }>(
      'SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL',
      [data.departmentId]
    );
    if (!dept[0]) throw AppError.notFound('Department not found');

    // Create auth account for the faculty member
    const passwordHash = await hashPassword(data.password);
    const { rows: userRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'faculty')
       RETURNING id`,
      [data.email, passwordHash]
    );
    const userId = userRows[0].id;

    // Validate only one HOD per department
    if (data.designation === 'hod') {
      const { rows: existingHOD } = await client.query<{ id: string }>(
        `SELECT id FROM faculty 
         WHERE department_id = $1 AND designation = 'hod' AND deleted_at IS NULL`,
        [data.departmentId]
      );
      if (existingHOD[0]) {
        throw AppError.badRequest('This department already has an assigned HOD.');
      }
    }

    // Create faculty profile
    const { rows: facultyRows } = await client.query<{ id: string }>(
      `INSERT INTO faculty
         (user_id, employee_number, full_name, department_id, designation)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, data.employeeNumber, data.fullName, data.departmentId, data.designation]
    );
    const facultyId = facultyRows[0].id;

    // Fetch full detail within the same transaction
    const { rows: detail } = await client.query<FacultyDetailRow>(
      `SELECT ${DETAIL_COLS} FROM faculty f ${JOINS} WHERE f.id = $1`,
      [facultyId]
    );

    await auditLog({
      actorId,
      action: 'CREATE_FACULTY',
      resource: 'faculty',
      resourceId: facultyId,
      changes: { employeeNumber: data.employeeNumber, email: data.email, role: 'faculty' },
    });

    return toDetail(detail[0]);
  });
}

export async function updateFaculty(
  id: string,
  data: UpdateFacultyInput,
  actorId: string
): Promise<FacultyDetail> {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = $${params.length}`);
  };

  if (data.fullName !== undefined) set('full_name', data.fullName);
  if (data.departmentId !== undefined) set('department_id', data.departmentId);
  if (data.designation !== undefined) set('designation', data.designation);

  // Validate only one HOD per department on update
  if (data.designation === 'hod' || (data.designation === undefined && data.departmentId !== undefined)) {
    const current = await getFacultyById(id);
    const finalDesig = data.designation ?? current.designation;
    const finalDept = data.departmentId ?? current.department.id;

    if (finalDesig === 'hod') {
      const { rows: existingHOD } = await query<{ id: string }>(
        `SELECT id FROM faculty 
         WHERE department_id = $1 AND designation = 'hod' AND id != $2 AND deleted_at IS NULL`,
        [finalDept, id]
      );
      if (existingHOD[0]) {
        throw AppError.badRequest('This department already has an assigned HOD.');
      }
    }
  }

  params.push(id);
  const { rowCount } = await query(
    `UPDATE faculty
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length} AND deleted_at IS NULL`,
    params
  );
  if (!rowCount) throw AppError.notFound('Faculty member not found');

  await auditLog({
    actorId,
    action: 'UPDATE_FACULTY',
    resource: 'faculty',
    resourceId: id,
    changes: data as Record<string, unknown>,
  });

  return getFacultyById(id);
}

export async function updateFacultyStatus(
  id: string,
  data: UpdateFacultyStatusInput,
  actorId: string
): Promise<FacultyDetail> {
  const { rowCount } = await query(
    `UPDATE faculty SET status = $1
     WHERE id = $2 AND deleted_at IS NULL`,
    [data.status, id]
  );
  if (!rowCount) throw AppError.notFound('Faculty member not found');

  await auditLog({
    actorId,
    action: 'UPDATE_FACULTY_STATUS',
    resource: 'faculty',
    resourceId: id,
    changes: { status: data.status },
  });

  return getFacultyById(id);
}

export async function deleteFaculty(id: string, actorId: string): Promise<void> {
  const { rowCount } = await query(
    `UPDATE faculty
     SET deleted_at = NOW(), status = 'resigned'
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rowCount) throw AppError.notFound('Faculty member not found');

  // Deactivate the linked auth account so the faculty member can no longer log in
  await query(
    `UPDATE users SET is_active = FALSE
     WHERE id = (SELECT user_id FROM faculty WHERE id = $1)`,
    [id]
  );

  await auditLog({
    actorId,
    action: 'DELETE_FACULTY',
    resource: 'faculty',
    resourceId: id,
  });
}
